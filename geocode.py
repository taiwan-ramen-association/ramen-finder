import json
import os
import subprocess
import sys
import time

def install(pkg):
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', pkg, '-q'])

try:
    import requests
except ImportError:
    print('安裝 requests 中...')
    install('requests')
    import requests

script_dir = os.path.dirname(os.path.abspath(__file__))
json_path  = os.path.join(script_dir, 'data.json')

print('📂 讀取 data.json...')
with open(json_path, 'r', encoding='utf-8') as f:
    rows = json.load(f)

to_geocode = [r for r in rows if not r.get('lat') or not r.get('lng')]
print(f'需要 geocode：{len(to_geocode)} 筆（共 {len(rows)} 筆）')

if not to_geocode:
    print('✅ 所有店家都已有座標，無需更新')
    input('按 Enter 關閉...')
    sys.exit(0)

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {'User-Agent': 'ramen-finder/1.0'}
updated      = 0
failed       = []
consecutive  = 0
MAX_CONSEC   = 5

def coords_from_map_url(url):
    """追蹤 Google Maps 縮短網址 redirect，從最終 URL 解出座標"""
    if not url or not url.startswith('http'):
        return None, None
    r = requests.get(url, headers=HEADERS, timeout=10, verify=False, allow_redirects=True)
    final = r.url
    # 格式 /@lat,lng,zoom（place URL）
    m = re.search(r'/@(-?\d+\.\d+),(-?\d+\.\d+)', final)
    if m:
        return float(m.group(1)), float(m.group(2))
    # 格式 ?q=lat,lng
    m = re.search(r'[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)', final)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None, None

def geocode_nominatim(address):
    """備用：Nominatim"""
    r = requests.get(
        'https://nominatim.openstreetmap.org/search',
        params={'q': address, 'format': 'json', 'limit': 1},
        headers=HEADERS, timeout=10, verify=False
    )
    results = r.json()
    return (float(results[0]['lat']), float(results[0]['lon'])) if results else (None, None)

for i, row in enumerate(to_geocode):
    name    = row.get('店名', '')
    address = row.get('地址', '') or name
    map_url = row.get('Map', '')
    print(f'[{i+1}/{len(to_geocode)}] {name}  {address}')
    try:
        # 第一次：從 Google Maps URL 解出座標（最準，不需 API key）
        lat, lng = coords_from_map_url(map_url)
        if lat:
            print(f'  ✓ (Map URL) {lat:.5f}, {lng:.5f}')

        # 第二次：Nominatim 備用
        if not lat:
            lat, lng = geocode_nominatim(address)

        if lat:
            row['lat'] = lat
            row['lng'] = lng
            updated += 1
            consecutive = 0
        else:
            failed.append(name)
            consecutive += 1
            print(f'  ✗ 找不到座標（連續失敗 {consecutive}/{MAX_CONSEC}）')
    except Exception as e:
        failed.append(name)
        consecutive += 1
        print(f'  ✗ 錯誤：{e}（連續失敗 {consecutive}/{MAX_CONSEC}）')

    if consecutive >= MAX_CONSEC:
        print(f'\n⚠ 連續失敗 {MAX_CONSEC} 筆，中斷作業')
        break
    time.sleep(1.1)  # Nominatim rate limit: 1 req/sec

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print(f'\n✅ 完成！新增 {updated} 筆座標')
if failed:
    print(f'⚠ 找不到座標（{len(failed)} 筆）：{", ".join(failed)}')
print()
input('按 Enter 關閉...')
