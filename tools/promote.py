"""
Beta → 正式版 推送腳本

用法：
  python tools/promote.py finder      # finder-beta.html → finder.html
  python tools/promote.py domination  # domination-beta.html → domination.html
  python tools/promote.py all         # 兩個都做
"""
import sys, re
from pathlib import Path

ROOT = Path(__file__).parent.parent

def promote_finder():
    src = ROOT / 'finder-beta.html'
    dst = ROOT / 'finder.html'
    text = src.read_text(encoding='utf-8')

    # 1. 移除 h1 BETA badge
    text = text.replace(
        ' <span style="font-size:11px;background:rgba(255,255,255,0.25);padding:2px 7px;border-radius:10px;font-weight:400;letter-spacing:0;">BETA</span>',
        ''
    )

    # 2. 登入成功：betaAccess → siteAccess，預設 director → all，訊息
    text = text.replace(
        "// 從 Firestore 讀取 featureFlags，決定 beta 存取門檻\n      let betaPermRole = 'director'; // 預設值\n      try {\n        const ffSnap = await db.collection('meta').doc('featureFlags').get();\n        if (ffSnap.exists && ffSnap.data().betaAccess?.perm) {\n          betaPermRole = ffSnap.data().betaAccess.perm;\n        }\n      } catch(e) { /* Firestore rules 未允許時沿用預設值 */ }\n\n      if (!hasPermission(userData.role, betaPermRole)) {\n        showBetaGate('此頁面僅開放特定身份瀏覽');\n        userAvatar.style.display = 'block';\n        return;\n      }",
        "// 從 Firestore 讀取 featureFlags，決定網站存取門檻\n      let sitePermRole = 'all'; // 預設值\n      try {\n        const ffSnap = await db.collection('meta').doc('featureFlags').get();\n        if (ffSnap.exists && ffSnap.data().siteAccess?.perm) {\n          sitePermRole = ffSnap.data().siteAccess.perm;\n        }\n      } catch(e) { /* Firestore rules 未允許時沿用預設值 */ }\n\n      if (!hasPermission(userData.role, sitePermRole)) {\n        showBetaGate('此頁面暫時關閉，請稍後再試');\n        userAvatar.style.display = 'block';\n        return;\n      }"
    )

    # 3. 未登入：betaAccess → siteAccess，預設 director → all，訊息
    text = text.replace(
        "// 未登入時也要檢查 betaAccess.perm，若為 'all' 則開放瀏覽\n      let betaPermRole = 'director';\n      try {\n        const ffSnap = await db.collection('meta').doc('featureFlags').get();\n        if (ffSnap.exists && ffSnap.data().betaAccess?.perm) {\n          betaPermRole = ffSnap.data().betaAccess.perm;\n        }\n      } catch(e) {}\n\n      if (betaPermRole === 'all') {\n        document.getElementById('betaGate').style.display  = 'none';\n        document.getElementById('loadingScreen').style.display = 'none';\n        document.getElementById('mainContent').classList.add('mc-show');\n        render();\n      } else {\n        showBetaGate('此頁面需要登入後才能瀏覽', true);\n      }",
        "// 未登入時檢查 siteAccess.perm，若為 'all' 則開放瀏覽\n      let sitePermRole = 'all';\n      try {\n        const ffSnap = await db.collection('meta').doc('featureFlags').get();\n        if (ffSnap.exists && ffSnap.data().siteAccess?.perm) {\n          sitePermRole = ffSnap.data().siteAccess.perm;\n        }\n      } catch(e) {}\n\n      if (sitePermRole === 'all') {\n        document.getElementById('betaGate').style.display  = 'none';\n        document.getElementById('loadingScreen').style.display = 'none';\n        document.getElementById('mainContent').classList.add('mc-show');\n        render();\n      } else {\n        showBetaGate('此頁面暫時關閉，請稍後再試');\n      }"
    )

    dst.write_text(text, encoding='utf-8')
    print(f'finder.html 已更新')


def promote_domination():
    src = ROOT / 'domination-beta.html'
    dst = ROOT / 'domination.html'
    text = src.read_text(encoding='utf-8')

    # 1. title 移除 BETA
    text = text.replace(
        '<title>制霸地圖 BETA ─ 台灣拉麵協會</title>',
        '<title>制霸地圖 ─ 台灣拉麵協會</title>'
    )

    # 2. GEO_CACHE_NAME 遞增版號（v1→v2, v2→v3, ...）
    def bump_version(m):
        n = int(m.group(1)) + 1
        return f"const GEO_CACHE_NAME = 'dom-geo-v{n}';"
    new_text, count = re.subn(
        r"const GEO_CACHE_NAME = 'dom-geo-v(\d+)';",
        bump_version, text
    )
    if count:
        text = new_text
        print(f'  GEO_CACHE_NAME 已遞增')

    dst.write_text(text, encoding='utf-8')
    print(f'domination.html 已更新')


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if target in ('finder', 'all'):
        promote_finder()
    if target in ('domination', 'all'):
        promote_domination()
