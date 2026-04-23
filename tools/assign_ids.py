"""
assign_ids.py — 為 data.json 的所有店家分配唯一 ID
格式：縣市代碼（1個英文字母）+ 5位數字，例如 A00001（臺北市第1間）

縣市代碼對照：
  A 臺北市  B 新北市  C 桃園市  D 臺中市  E 臺南市  F 高雄市
  G 基隆市  H 新竹市  I 新竹縣  J 苗栗縣  K 彰化縣  L 南投縣
  M 雲林縣  N 嘉義市  O 嘉義縣  P 屏東縣  Q 宜蘭縣  R 花蓮縣
  S 臺東縣  T 澎湖縣  U 金門縣  V 連江縣  Z 未知縣市
"""
import json
import os
import re

CITY_CODE = {
    '臺北市': 'A', '台北市': 'A',
    '新北市': 'B',
    '桃園市': 'C',
    '臺中市': 'D', '台中市': 'D',
    '臺南市': 'E', '台南市': 'E',
    '高雄市': 'F',
    '基隆市': 'G',
    '新竹市': 'H',
    '新竹縣': 'I',
    '苗栗縣': 'J',
    '彰化縣': 'K',
    '南投縣': 'L',
    '雲林縣': 'M',
    '嘉義市': 'N',
    '嘉義縣': 'O',
    '屏東縣': 'P',
    '宜蘭縣': 'Q',
    '花蓮縣': 'R',
    '臺東縣': 'S', '台東縣': 'S',
    '澎湖縣': 'T',
    '金門縣': 'U',
    '連江縣': 'V',
}

ID_RE = re.compile(r'^[A-Z]\d{5}$')


def get_city(row):
    """從 縣市 欄位或地址解析縣市名稱"""
    city = str(row.get('縣市', '')).strip()
    if not city:
        addr = str(row.get('地址', '')).strip()
        addr = re.sub(r'^\d{3,6}', '', addr)  # 移除郵遞區號
        city = addr[:3]
    return city.replace('台', '臺')


def assign_ids(rows):
    """
    保留現有合法 ID，對空白/不合法的 ID 依縣市順序補號。
    回傳 (updated_rows, assigned_count)
    """
    # 先掃描現有最大流水號
    city_max = {}
    for row in rows:
        eid = str(row.get('ID', '')).strip()
        if ID_RE.match(eid):
            letter = eid[0]
            num = int(eid[1:])
            city_max[letter] = max(city_max.get(letter, 0), num)

    assigned = 0
    for row in rows:
        eid = str(row.get('ID', '')).strip()
        if ID_RE.match(eid):
            continue  # 已有合法 ID，跳過
        city = get_city(row)
        letter = CITY_CODE.get(city, 'Z')
        next_num = city_max.get(letter, 0) + 1
        city_max[letter] = next_num
        row['ID'] = f'{letter}{next_num:05d}'
        assigned += 1

    return rows, assigned


def reorder_id_first(rows):
    """確保 ID 欄位排在第一位"""
    result = []
    for row in rows:
        new_row = {'ID': row.get('ID', '')}
        for k, v in row.items():
            if k != 'ID':
                new_row[k] = v
        result.append(new_row)
    return result


if __name__ == '__main__':
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir  = os.path.dirname(tools_dir)
    json_path = os.path.join(root_dir, 'data', 'data.json')

    with open(json_path, 'r', encoding='utf-8') as f:
        rows = json.load(f)

    print(f'讀取 {len(rows)} 筆店家資料...')
    rows, assigned = assign_ids(rows)
    rows = reorder_id_first(rows)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f'✅ 完成！已為 {assigned} 間店家分配 ID')

    # 統計各縣市
    code_to_city = {v: k for k, v in CITY_CODE.items() if k.startswith('臺') or k not in {kk for kk, vv in CITY_CODE.items() if kk.startswith('臺') and vv == v}}
    # 簡化：直接建完整對照
    code_to_city = {
        'A': '臺北市', 'B': '新北市', 'C': '桃園市', 'D': '臺中市',
        'E': '臺南市', 'F': '高雄市', 'G': '基隆市', 'H': '新竹市',
        'I': '新竹縣', 'J': '苗栗縣', 'K': '彰化縣', 'L': '南投縣',
        'M': '雲林縣', 'N': '嘉義市', 'O': '嘉義縣', 'P': '屏東縣',
        'Q': '宜蘭縣', 'R': '花蓮縣', 'S': '臺東縣', 'T': '澎湖縣',
        'U': '金門縣', 'V': '連江縣', 'Z': '未知縣市',
    }

    city_counts = {}
    for row in rows:
        letter = row.get('ID', 'Z')[0] if row.get('ID') else 'Z'
        city_counts[letter] = city_counts.get(letter, 0) + 1

    print('\n各縣市店家數量：')
    for letter in sorted(city_counts):
        print(f'  {letter} {code_to_city.get(letter, letter)}: {city_counts[letter]} 間')
