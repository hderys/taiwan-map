import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ========== 設定區 ==========
origin_folder = "web_photos_origin"
blur_folder = "web_photos_blur"
output_folder = "web_photos"

watermark_text = "Taiwan Memory Map"
font_size = 40
opacity = 120
position = "bottom-right"

# 人臉模糊參數
blur_method = "gaussian"       # "gaussian" 或 "mosaic"
gaussian_ksize = (99, 99)       # 高斯模糊強度
mosaic_division = 6             # 馬賽克粗細（數字越小越粗）
# ============================

os.makedirs(blur_folder, exist_ok=True)
os.makedirs(output_folder, exist_ok=True)

# 載入兩個 Haar 級聯分類器（正面 + 側面）
face_cascade_frontal = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
face_cascade_profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")

def blur_faces_haar(image_path, output_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"無法讀取圖片：{image_path}")
        return False
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 提高偵測靈敏度：scaleFactor=1.05, minNeighbors=3, minSize=(30,30)
    faces = face_cascade_frontal.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30,30))
    faces_profile = face_cascade_profile.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30,30))
    all_faces = list(faces) + list(faces_profile)
    
    for (x, y, w, h) in all_faces:
        face_roi = img[y:y+h, x:x+w]
        if face_roi.size == 0:
            continue
        if blur_method == "gaussian":
            blurred = cv2.GaussianBlur(face_roi, gaussian_ksize, 30)
        else:
            small = cv2.resize(face_roi, (max(1, w//mosaic_division), max(1, h//mosaic_division)))
            blurred = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
        img[y:y+h, x:x+w] = blurred
    
    cv2.imwrite(output_path, img)
    print(f"✓ 人臉模糊：{os.path.basename(image_path)} (偵測到 {len(all_faces)} 張臉)")
    return True

def add_watermark(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    txt = Image.new("RGBA", img.size, (255,255,255,0))
    draw = ImageDraw.Draw(txt)
    try:
        font = ImageFont.truetype("msjh.ttc", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", font_size)
        except:
            font = ImageFont.load_default()
    bbox = draw.textbbox((0,0), watermark_text, font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    padding = 20
    xy = (img.width - tw - padding, img.height - th - padding) if position == "bottom-right" else (padding, padding)
    draw.text(xy, watermark_text, font=font, fill=(255,255,255,opacity))
    combined = Image.alpha_composite(img, txt)
    combined.convert("RGB").save(output_path)
    print(f"  + 浮水印：{os.path.basename(output_path)}")

# ========== 主流程 ==========
if __name__ == "__main__":
    print("🔍 步驟一：使用強化Haar分類器偵測人臉（正面+側面）...")
    for fname in os.listdir(origin_folder):
        if fname.lower().endswith((".jpg", ".jpeg", ".png")):
            src = os.path.join(origin_folder, fname)
            dst = os.path.join(blur_folder, fname)
            blur_faces_haar(src, dst)
    
    print("\n🖌️ 步驟二：加上浮水印...")
    for fname in os.listdir(blur_folder):
        if fname.lower().endswith((".jpg", ".jpeg", ".png")):
            src = os.path.join(blur_folder, fname)
            dst = os.path.join(output_folder, fname)
            add_watermark(src, dst)
    
    print(f"\n✅ 全部完成！最終照片在 {output_folder}")
    print("👉 請將此資料夾內容複製到網站的 web_photos，然後重新部署。")