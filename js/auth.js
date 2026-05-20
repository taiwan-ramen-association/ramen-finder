// ── auth.js ──────────────────────────────────────────────────────────────────
// Firebase 初始化、登入/登出、Profile dropdown、Feature Flags、Beta Gate
// 依賴全域（其他 JS 模組）：
//   showStampToast, loadStamps（stamps.js）
//   compressImage（reviews.js）
//   favSet, stampMap, reviewMap（stamps.js）
// 依賴全域（主 inline script）：
//   showFavOnly, render, _currentPage, switchPage, checkUnreadBadge,
//   _onDataLoaded, _onBdAnimDone, openOnboardingModal
// 提供全域：
//   auth, db, storage, provider, firebase (透過 initializeApp)
//   currentUserRole, currentDisplayName, currentAvatarUrl, isWarned
//   featureFlags（含 vis/perm 設定）
//   canView, canUse, showAccessToast, hasPermission, getRoleLevel
//   loadFeatureFlags, applyFeatureFlags
//   getAvatarUrl, applyAvatarUrl
//   showBetaGate, openPrivacyModal, closePrivacyModal, doGoogleSignIn

// ── 1. Firebase Init ─────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBdN0AYZMM2AU66QcH4BVNJHx1plwQBBYc",
  authDomain: "taiwan-ramen-association.firebaseapp.com",
  projectId: "taiwan-ramen-association",
  storageBucket: "taiwan-ramen-association.firebasestorage.app",
  messagingSenderId: "66234065738",
  appId: "1:66234065738:web:eb9fc4348a942da66ad7b3"
};
firebase.initializeApp(firebaseConfig);
const auth     = firebase.auth();
const db       = firebase.firestore();
const storage  = firebase.storage();
const provider = new firebase.auth.GoogleAuthProvider();

// ── 2. DOM refs ──────────────────────────────────────────────────────────────
const loginBtn         = document.getElementById('loginBtn');
const userAvatar       = document.getElementById('userAvatar');
const logoutBtn        = document.getElementById('logoutBtn');
const adminLink        = document.getElementById('adminLink');
const profileDropdown  = document.getElementById('profileDropdown');
const pdHeaderAvatar   = document.getElementById('pdHeaderAvatar');
const pdDisplayName    = document.getElementById('pdDisplayName');
const pdEmail          = document.getElementById('pdEmail');
const nicknameInput    = document.getElementById('nicknameInput');
const saveProfileBtn   = document.getElementById('saveProfileBtn');
const localAvatarInput = document.getElementById('localAvatarInput');

let _googlePhotoURL = '';
let _localAvatarUid = null;

// ── 3. Role / Feature Flag State ─────────────────────────────────────────────
var currentUserRole    = ''; // 登入後由 onAuthStateChanged 填入
var currentDisplayName = '';
var currentAvatarUrl   = '';
var isWarned           = false;

var featureFlags = {
  favorites:      { vis: 'viewer',   perm: 'viewer'   },
  stamps:         { vis: 'viewer',   perm: 'viewer'   },
  queueReport:    { vis: 'director', perm: 'director' },
  rankings:       { vis: 'viewer',   perm: 'viewer'   },
  domination:     { vis: 'viewer',   perm: 'viewer'   },
  reviews:        { vis: 'all',      perm: 'viewer'   },
  challengesNav:  { vis: 'admin',    perm: 'admin'    },
  nonActiveShops: { vis: 'all',      perm: 'viewer'   },
  onboardingTour: { vis: 'viewer',   perm: 'viewer'   },
};

const ROLE_LEVEL = { all: 0, viewer: 1, member: 2, director: 3, admin: 4 };
const MEMBER_ROLES = ['member_individual','member_group','member_sponsor','member_honorary'];

function getRoleLevel(role) {
  if (role === 'admin')    return 4;
  if (role === 'director') return 3;
  if (MEMBER_ROLES.includes(role)) return 2;
  if (role === 'viewer' || role === 'store') return 1;
  return 0;
}

function canView(feature) {
  const flag = featureFlags[feature];
  if (!flag) return true;
  const req = ROLE_LEVEL[flag.vis] ?? 1;
  return getRoleLevel(currentUserRole) >= req;
}

function canUse(feature) {
  const flag = featureFlags[feature];
  if (!flag) return true;
  const req = ROLE_LEVEL[flag.perm] ?? 1;
  return getRoleLevel(currentUserRole) >= req;
}

// 未登入 vs 已登入無權限，顯示對應提示
function showAccessToast() {
  if (!auth.currentUser) {
    showStampToast('請先登入以使用此功能');
  } else {
    showStampToast('此功能目前暫不開放');
  }
}

async function loadFeatureFlags() {
  try {
    const snap = await db.collection('meta').doc('featureFlags').get();
    if (snap.exists) featureFlags = { ...featureFlags, ...snap.data() };
  } catch(e) {}
}

function hasPermission(userRole, requiredRole) {
  return getRoleLevel(userRole) >= (ROLE_LEVEL[requiredRole] ?? 99);
}

// ── 4. Avatar utilities ──────────────────────────────────────────────────────
function localAvatarKey(uid) { return 'avatarCache_' + uid; }

function getAvatarUrl(userData, googlePhotoURL) {
  return userData?.avatarUrl || googlePhotoURL || 'assets/icons/03.png';
}

function applyAvatarUrl(url) {
  if (!url) return;
  userAvatar.src     = url;
  pdHeaderAvatar.src = url;
}

function applyLocalAvatarCache(uid) {
  const cached = uid && localStorage.getItem(localAvatarKey(uid));
  if (cached) { applyAvatarUrl(cached); return true; }
  return false;
}

// ── 5. Profile Dropdown ──────────────────────────────────────────────────────
function closeProfileDropdown() {
  profileDropdown.style.display = 'none';
  document.getElementById('pdNickPopup').style.display = 'none';
}

userAvatar.addEventListener('click', e => {
  e.stopPropagation();
  const isOpen = profileDropdown.style.display !== 'none';
  if (isOpen) {
    closeProfileDropdown();
  } else {
    document.getElementById('drawer').style.display = 'none';
    document.getElementById('drawerBackdrop').style.display = 'none';
    profileDropdown.style.display = 'block';
  }
});

document.addEventListener('click', e => {
  if (!profileDropdown.contains(e.target) && e.target !== userAvatar) {
    closeProfileDropdown();
  }
});

// 📷 頭像區塊點擊 → 開啟檔案選取
document.getElementById('pdAvatarWrap').addEventListener('click', () => localAvatarInput.click());

localAvatarInput.addEventListener('change', async () => {
  const file = localAvatarInput.files[0];
  if (!file || !auth.currentUser) return;
  localAvatarInput.value = '';
  showStampToast('壓縮中…');
  try {
    const uid  = auth.currentUser.uid;
    const blob = await compressImage(file, { maxPx: 400, maxKB: 100 });
    const snap = await storage.ref(`avatars/${uid}.webp`).put(blob, { contentType: 'image/webp' });
    const url  = await snap.ref.getDownloadURL();
    await db.collection('users').doc(uid).update({ avatarUrl: url });
    await db.collection('userProfiles').doc(uid).set({ avatarUrl: url }, { merge: true });
    applyAvatarUrl(url);
    try { localStorage.setItem(localAvatarKey(uid), url); } catch {}
    showStampToast('✅ 頭像已更新！');
  } catch (err) {
    console.error('頭像上傳失敗', err);
    showStampToast('❌ 頭像上傳失敗');
  }
});

// 📝 顯示身份按鈕 → 開關綽號編輯 popup
pdDisplayName.addEventListener('click', e => {
  e.stopPropagation();
  const popup  = document.getElementById('pdNickPopup');
  const isOpen = popup.style.display !== 'none';
  popup.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    nicknameInput.value = pdDisplayName.textContent;
    nicknameInput.focus();
  }
});

document.getElementById('pdNickCancelBtn').addEventListener('click', () => {
  document.getElementById('pdNickPopup').style.display = 'none';
});

// 💾 儲存綽號
saveProfileBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;
  saveProfileBtn.disabled = true;
  saveProfileBtn.textContent = '儲存中…';
  try {
    const nickname = nicknameInput.value.trim();
    await db.collection('users').doc(user.uid).update({ nickname });
    await db.collection('userProfiles').doc(user.uid).set(
      { nickname, displayName: nickname || user.displayName || '' },
      { merge: true }
    );
    pdDisplayName.textContent = nickname || user.displayName || '';
    document.getElementById('pdNickPopup').style.display = 'none';
    showStampToast('✅ 已儲存！');
  } catch (e) {
    console.error('儲存失敗', e);
    showStampToast('❌ 儲存失敗');
  }
  saveProfileBtn.disabled = false;
  saveProfileBtn.textContent = '儲存';
});

logoutBtn.addEventListener('click', () => {
  closeProfileDropdown();
  auth.signOut();
});

// ── 6. applyFeatureFlags ─────────────────────────────────────────────────────
function applyFeatureFlags() {
  // 非現存店家設定（sf-modal 內）
  const sfNonActiveRow = document.querySelector('.sf-toggle-row:has(#sfShowNonActive)');
  if (sfNonActiveRow) sfNonActiveRow.style.display = canView('nonActiveShops') ? '' : 'none';

  // 收藏按鈕（bottom nav）
  const bnavFavorites = document.getElementById('bnavFavorites');
  if (bnavFavorites) bnavFavorites.style.display = canView('favorites') ? '' : 'none';

  // 排行榜按鈕（profile dropdown）
  const rkPdBtn = document.getElementById('rankingsPdBtn');
  if (rkPdBtn) {
    rkPdBtn.style.display = canView('rankings') ? '' : 'none';
    rkPdBtn.classList.toggle('ff-locked', canView('rankings') && !canUse('rankings'));
  }

  // 制霸地圖連結
  const domLink = document.querySelector('.pd-action[href="domination.html"]');
  if (domLink) {
    domLink.style.display = canView('domination') ? '' : 'none';
    domLink.classList.toggle('ff-locked', canView('domination') && !canUse('domination'));
  }

  // 貼文 nav bar
  const bnavPosts = document.getElementById('bnavPosts');
  if (bnavPosts) {
    const show = canView('postsNav');
    bnavPosts.style.display = show ? '' : 'none';
    bnavPosts.classList.toggle('ff-locked', show && !canUse('postsNav'));
    if (!show && _currentPage === 'reviews') switchPage('finder');
  }

  const bnavChallenges = document.getElementById('bnavChallenges');
  if (bnavChallenges) {
    const show = canView('challengesNav');
    bnavChallenges.style.display = show ? '' : 'none';
    bnavChallenges.classList.toggle('ff-locked', show && !canUse('challengesNav'));
    if (!show && _currentPage === 'challenges') switchPage('finder');
  }

  // 新手導覽（漢堡選單）
  const resetOnboardBtn = document.getElementById('resetOnboardBtn');
  if (resetOnboardBtn) resetOnboardBtn.style.display = canView('onboardingTour') ? '' : 'none';
}

// ── 7. Beta Gate ─────────────────────────────────────────────────────────────
function showBetaGate(msg, showLogin = false) {
  document.getElementById('betaGate').style.display = 'flex';
  document.getElementById('betaGateMsg').textContent = msg;
  document.getElementById('betaLoginBtn').style.display = showLogin ? 'flex' : 'none';
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('mainContent').classList.remove('mc-show');
}

document.getElementById('betaLoginBtn').addEventListener('click', () => openPrivacyModal());

// ── 8. onAuthStateChanged ────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  try {
    if (user) {
      _googlePhotoURL = user.photoURL || '';
      loginBtn.style.display = 'none';
      userAvatar.style.display = 'block';

      const userRef = db.collection('users').doc(user.uid);
      await userRef.set({
        displayName: user.displayName || '',
        email:       user.email || '',
        photoURL:    user.photoURL || '',
        lastLogin:   firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const snap     = await userRef.get();
      const userData = snap.data();

      // 第一次登入：設定基本欄位 + 自動分配 memberNo
      if (!userData.role) {
        // Step 1：先寫入基本欄位（獨立，確保一定成功）
        try {
          await userRef.update({
            role: 'viewer', level: 0, postCount: 0, likeCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error('[首次登入] 寫入基本欄位失敗：', e);
        }
        // Step 2：分配 memberNo（Transaction 確保不重複）
        try {
          const counterRef = db.collection('meta').doc('counters');
          await db.runTransaction(async tx => {
            const cs = await tx.get(counterRef);
            const memberNo = cs.exists ? (cs.data().memberCount || 0) + 1 : 1;
            tx.set(counterRef, { memberCount: memberNo }, { merge: true });
            tx.update(userRef, { memberNo });
          });
        } catch (e) {
          console.error('[首次登入] memberNo 分配失敗：', e);
        }
        const snap2 = await userRef.get();
        Object.assign(userData, snap2.data());
      }

      // 同步公開 profile（讓其他登入用戶可讀 nickname / avatarUrl）
      try {
        await db.collection('userProfiles').doc(user.uid).set({
          displayName: userData.nickname || user.displayName || '匿名',
          nickname:    userData.nickname || '',
          avatarUrl:   userData.avatarUrl || user.photoURL || '',
        }, { merge: true });
      } catch(e) { console.warn('userProfiles sync failed', e); }

      // 從 Firestore 讀取 featureFlags，決定網站存取門檻
      let betaPermRole = 'all'; // 預設值
      try {
        const ffSnap = await db.collection('meta').doc('featureFlags').get();
        if (ffSnap.exists && ffSnap.data().betaAccess?.perm) {
          betaPermRole = ffSnap.data().betaAccess.perm;
        }
      } catch(e) { /* Firestore rules 未允許時沿用預設值 */ }

      if (!hasPermission(userData.role, betaPermRole)) {
        showBetaGate('此頁面暫時關閉，請稍後再試');
        userAvatar.style.display = 'block';
        return;
      }

      document.getElementById('betaGate').style.display = 'none';

      // 頭像：Firestore avatarUrl > Google photoURL，localStorage 只做 URL 快取加速
      _localAvatarUid = user.uid;
      const avatar = getAvatarUrl(userData, user.photoURL);
      applyAvatarUrl(avatar);
      applyLocalAvatarCache(user.uid); // 若有快取 URL 先顯示（避免閃爍）
      // Google 帳號區（唯讀）
      document.getElementById('pdGoogleAvatar').src        = user.photoURL || 'assets/icons/03.png';
      document.getElementById('pdGoogleName').textContent  = user.displayName || '';
      pdEmail.value = user.email || '';
      // 自定義顯示身份區
      pdDisplayName.textContent                            = userData.nickname || user.displayName || '';
      nicknameInput.value                                  = userData.nickname || '';
      adminLink.style.display   = userData.role === 'admin' ? 'flex' : 'none';
      isWarned = userData.role === 'warned';
      currentUserRole    = userData.role || 'viewer';
      currentDisplayName = userData.nickname || user.displayName || '匿名';
      currentAvatarUrl   = avatar;

      // 載入收藏清單 + 踩點記錄
      const favIds = userData.favorites || [];
      favSet = new Set(favIds);
      await loadStamps(user.uid);
      applyFeatureFlags();
      render();
      checkUnreadBadge();
      _onDataLoaded(() => _onBdAnimDone(() => { if (!localStorage.getItem('onboarding_done_' + user.uid)) openOnboardingModal(); }));
    } else {
      loginBtn.style.display   = 'flex';
      userAvatar.style.display = 'none';
      isWarned = false;
      currentUserRole    = '';
      currentDisplayName = '';
      currentAvatarUrl   = '';
      _localAvatarUid = null;
      favSet = new Set();
      stampMap = {}; reviewMap = {};
      showFavOnly = false;
      document.getElementById('mainContent').classList.remove('fav-mode');
      if (_currentPage === 'favorites') switchPage('finder');
      closeProfileDropdown();
      applyFeatureFlags();

      // 未登入時檢查 betaAccess.perm，若為 'all' 則開放瀏覽
      let betaPermRole = 'all';
      try {
        const ffSnap = await db.collection('meta').doc('featureFlags').get();
        if (ffSnap.exists && ffSnap.data().betaAccess?.perm) {
          betaPermRole = ffSnap.data().betaAccess.perm;
        }
      } catch(e) {}

      if (betaPermRole === 'all') {
        document.getElementById('betaGate').style.display  = 'none';
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainContent').classList.add('mc-show');
        render();
      } else {
        showBetaGate('此頁面暫時關閉，請稍後再試');
      }
    }
  } catch (err) {
    console.error('auth state 處理失敗', err);
    loginBtn.style.display   = 'flex';
    userAvatar.style.display = 'none';
  }
});

// ── 9. Privacy Modal & Login Flow ────────────────────────────────────────────
function openPrivacyModal() {
  document.getElementById('privacyModal').classList.add('open');
}
function closePrivacyModal() {
  document.getElementById('privacyModal').classList.remove('open');
}
function doGoogleSignIn() {
  closePrivacyModal();
  auth.signInWithPopup(provider).catch(err => {
    if (err.code === 'auth/popup-blocked') {
      auth.signInWithRedirect(provider).catch(e => console.error('redirect 登入失敗', e));
    } else if (err.code !== 'auth/popup-closed-by-user') {
      console.error('登入失敗', err);
    }
  });
}
document.getElementById('privacyGoogleBtn').addEventListener('click', doGoogleSignIn);
document.getElementById('privacySkipBtn').addEventListener('click', closePrivacyModal);

loginBtn.addEventListener('click', () => openPrivacyModal());

auth.getRedirectResult().catch(err => {
  if (err.code && err.code !== 'auth/no-auth-event') {
    console.error('redirect 登入失敗', err);
    auth.signOut();
  }
});
