#!/usr/bin/env python3
from PIL import Image, ImageDraw

def create_note_icon(size, output_path):
    """创建美观的笔记图标"""
    # 创建透明背景图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 图标设计参数（基于尺寸自适应）
    padding = int(size * 0.12)
    corner_radius = int(size * 0.15)

    # 主卡片区域
    card_left = padding
    card_top = padding
    card_right = size - padding
    card_bottom = size - padding

    # 绘制圆角矩形（使用多边形模拟）
    points = []

    # 顶部边缘
    for x in range(card_left + corner_radius, card_right - corner_radius + 1):
        points.append((x, card_top))

    # 右上角圆弧
    for angle in range(90, 180):
        import math
        rad = math.radians(angle)
        x = card_right - corner_radius + corner_radius * math.cos(rad)
        y = card_top + corner_radius + corner_radius * math.sin(rad)
        points.append((x, y))

    # 右侧边缘
    for y in range(card_top + corner_radius, card_bottom - corner_radius + 1):
        points.append((card_right, y))

    # 右下角圆弧
    for angle in range(180, 270):
        import math
        rad = math.radians(angle)
        x = card_right - corner_radius + corner_radius * math.cos(rad)
        y = card_bottom - corner_radius + corner_radius * math.sin(rad)
        points.append((x, y))

    # 底部边缘
    for x in range(card_right - corner_radius, card_left + corner_radius - 1, -1):
        points.append((x, card_bottom))

    # 左下角圆弧
    for angle in range(270, 360):
        import math
        rad = math.radians(angle)
        x = card_left + corner_radius + corner_radius * math.cos(rad)
        y = card_bottom - corner_radius + corner_radius * math.sin(rad)
        points.append((x, y))

    # 左侧边缘
    for y in range(card_bottom - corner_radius, card_top + corner_radius - 1, -1):
        points.append((card_left, y))

    # 左上角圆弧
    for angle in range(0, 90):
        import math
        rad = math.radians(angle)
        x = card_left + corner_radius + corner_radius * math.cos(rad)
        y = card_top + corner_radius + corner_radius * math.sin(rad)
        points.append((x, y))

    # 绘制主卡片（浅蓝色背景）
    draw.polygon(points, fill=(66, 133, 244, 255))  # Google蓝色

    # 绘制折叠角落效果
    fold_size = int(size * 0.2)
    fold_points = [
        (card_right - fold_size, card_top),
        (card_right, card_top),
        (card_right, card_top + fold_size)
    ]
    draw.polygon(fold_points, fill=(51, 110, 220, 255))  # 深蓝色

    # 绘制纸张效果（白色线条代表笔记内容）
    line_start_x = card_left + int(size * 0.15)
    line_end_x = card_right - int(size * 0.15) - fold_size // 2
    line_height = int(size * 0.06)
    line_spacing = int(size * 0.12)
    start_y = card_top + int(size * 0.25)
    line_color = (255, 255, 255, 200)  # 白色带透明度

    # 绘制3-4条横线表示笔记内容
    for i in range(4):
        y = start_y + i * line_spacing
        if i == 0:
            # 第一行稍宽（标题）
            line_width = int((line_end_x - line_start_x) * 0.6)
        else:
            # 内容行
            line_width = int((line_end_x - line_start_x) * (0.9 - i * 0.15))
        draw.line([(line_start_x, y), (line_start_x + line_width, y)], fill=line_color, width=max(1, size // 32))

    # 添加圆点作为bullet points
    dot_radius = max(1, size // 48)
    dot_x = card_left + int(size * 0.08)
    for i in range(3):
        dot_y = start_y + i * line_spacing + line_height // 2
        draw.ellipse([(dot_x - dot_radius, dot_y - dot_radius),
                     (dot_x + dot_radius, dot_y + dot_radius)],
                    fill=(255, 255, 255, 255))

    # 保存为PNG
    img.save(output_path, 'PNG')

def create_icon_set():
    """创建完整的图标集"""
    sizes = [16, 48, 128]
    base_path = '/workspace/quick-notes-extension/icons/'

    for size in sizes:
        output_path = f'{base_path}icon{size}.png'
        create_note_icon(size, output_path)
        print(f'✓ Created {output_path}')

if __name__ == '__main__':
    create_icon_set()
    print('\n✨ All icons created successfully!')
