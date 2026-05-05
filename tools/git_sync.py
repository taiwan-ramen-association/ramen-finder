"""
git_sync.py — Git 同步工具
A  全部 Pull（Public + Private）
B  全部 Push（Public + Private）
1  Public Pull   （主 repo）
2  Public Push   （主 repo）
3  Private Pull  （_memory）
4  Private Push  （_memory）
s  查看兩個 repo 狀態
"""
import os
import subprocess
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stdin.reconfigure(encoding='utf-8')

tools_dir  = os.path.dirname(os.path.abspath(__file__))
root_dir   = os.path.dirname(tools_dir)
memory_dir = os.path.join(root_dir, '_memory')

PUBLIC_LABEL  = 'Public  (taiwan-ramen-association.github.io)'
PRIVATE_LABEL = 'Private (_memory / ramen-finder-notes)'


def section(title):
    print()
    print('─' * 54)
    print(f'  {title}')
    print('─' * 54)


def run_git(args, cwd):
    result = subprocess.run(
        ['git'] + args,
        cwd=cwd, capture_output=True, text=True, encoding='utf-8'
    )
    out = (result.stdout + result.stderr).strip()
    if out:
        print(out)
    return result.returncode == 0


def git_pull(cwd, label):
    section(f'Pull — {label}')
    ok = run_git(['pull'], cwd=cwd)
    print(f'\n  {"✅ 完成" if ok else "❌ 失敗"}')
    return ok


def git_push(cwd, label):
    section(f'Push — {label}')

    # 顯示目前狀態
    result = subprocess.run(
        ['git', 'status', '--short'],
        cwd=cwd, capture_output=True, text=True, encoding='utf-8'
    )
    status = result.stdout.strip()

    if not status:
        print('  ℹ  無變更，略過')
        return True

    print('\n  未提交的變更：')
    print(status)
    print()

    # 讓使用者選擇要 add 哪些檔案
    print('  選擇要 stage 的範圍：')
    print('    A  git add -A（全部）')
    print('    M  僅已追蹤的修改（git add -u）')
    print('    F  手動輸入檔案路徑')
    print('    N  取消')
    add_choice = input('\n  請選擇 (A/M/F/N)：').strip().upper()

    if add_choice == 'N' or add_choice == '':
        print('  ↩ 取消')
        return False
    elif add_choice == 'A':
        run_git(['add', '-A'], cwd=cwd)
    elif add_choice == 'M':
        run_git(['add', '-u'], cwd=cwd)
    elif add_choice == 'F':
        files = input('  輸入檔案路徑（空格分隔）：').strip()
        if not files:
            print('  ↩ 取消')
            return False
        run_git(['add'] + files.split(), cwd=cwd)
    else:
        print(f'  ⚠  無效選項')
        return False

    # 顯示 staged diff
    result = subprocess.run(
        ['git', 'diff', '--cached', '--stat'],
        cwd=cwd, capture_output=True, text=True, encoding='utf-8'
    )
    cached = result.stdout.strip()
    if not cached:
        print('  ℹ  沒有已 staged 的變更，不需要 commit')
        return True
    print(f'\n{cached}\n')

    # commit 訊息
    msg = input('  commit 訊息（Enter = 使用 "update"）：').strip()
    if not msg:
        msg = 'update'

    if not run_git(['commit', '-m', msg], cwd=cwd):
        print('  ❌ commit 失敗')
        return False

    print('\n  🚀 推送中...')
    ok = run_git(['push'], cwd=cwd)
    print(f'\n  {"✅ Push 完成！" if ok else "❌ Push 失敗"}')
    return ok


def git_status():
    section(f'Status — {PUBLIC_LABEL}')
    run_git(['status', '--short', '--branch'], cwd=root_dir)

    section(f'Status — {PRIVATE_LABEL}')
    if not os.path.isdir(memory_dir):
        print('  ⚠  _memory/ 不存在，請先 clone private repo')
        print('  git clone https://github.com/taiwan-ramen-association/ramen-finder-notes _memory')
        return
    run_git(['status', '--short', '--branch'], cwd=memory_dir)


def check_memory():
    if not os.path.isdir(memory_dir):
        print('\n  ⚠  _memory/ 不存在，略過 Private')
        print('  提示：git clone https://github.com/taiwan-ramen-association/ramen-finder-notes _memory')
        return False
    return True


def show_menu():
    print()
    print('╔' + '═' * 52 + '╗')
    print('║{:^52}║'.format('Git 同步工具　Git Sync'))
    print('╠' + '═' * 52 + '╣')
    print('║  A  【全部 Pull】 Public + Private{:<17}║'.format(''))
    print('║  B  【全部 Push】 Public + Private{:<17}║'.format(''))
    print('║  ' + '─' * 49 + '║')
    print('║  1  【Public  Pull】 主 repo{:<23}║'.format(''))
    print('║  2  【Public  Push】 主 repo{:<23}║'.format(''))
    print('║  3  【Private Pull】 _memory{:<23}║'.format(''))
    print('║  4  【Private Push】 _memory{:<23}║'.format(''))
    print('║  ' + '─' * 49 + '║')
    print('║  s  查看兩個 repo 狀態{:<29}║'.format(''))
    print('║  q  離開{:<43}║'.format(''))
    print('╚' + '═' * 52 + '╝')


# ════════════════════════════════════════════════════════════════════════════════
# 主迴圈
# ════════════════════════════════════════════════════════════════════════════════
while True:
    show_menu()
    choice = input('\n請輸入選項：').strip().lower()

    if choice == 'q':
        print('\n掰掰')
        break

    elif choice == 'a':
        git_pull(root_dir, PUBLIC_LABEL)
        if check_memory():
            git_pull(memory_dir, PRIVATE_LABEL)
        input('\n按 Enter 繼續...')

    elif choice == 'b':
        git_push(root_dir, PUBLIC_LABEL)
        if check_memory():
            git_push(memory_dir, PRIVATE_LABEL)
        input('\n按 Enter 繼續...')

    elif choice == '1':
        git_pull(root_dir, PUBLIC_LABEL)
        input('\n按 Enter 繼續...')

    elif choice == '2':
        git_push(root_dir, PUBLIC_LABEL)
        input('\n按 Enter 繼續...')

    elif choice == '3':
        if check_memory():
            git_pull(memory_dir, PRIVATE_LABEL)
        input('\n按 Enter 繼續...')

    elif choice == '4':
        if check_memory():
            git_push(memory_dir, PRIVATE_LABEL)
        input('\n按 Enter 繼續...')

    elif choice == 's':
        git_status()
        input('\n按 Enter 繼續...')

    else:
        print(f'\n  ⚠  「{choice}」不是有效的選項')
        input('\n按 Enter 繼續...')
