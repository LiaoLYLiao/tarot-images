import os
import re
import io
import urllib.parse
import requests
from bs4 import BeautifulSoup
from PIL import Image

BASE_URL = "https://www.osho.tw/zen%20card/{n}.htm"
OUTPUT_DIR = "downloaded_cards"

os.makedirs(OUTPUT_DIR, exist_ok=True)

for n in range(1, 80):
    page_url = BASE_URL.format(n=n)
    print(f"Processing {page_url}")
    try:
        resp = requests.get(page_url, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
    except Exception as e:
        print(f"  Failed to download page: {e}")
        continue

    soup = BeautifulSoup(resp.text, "html.parser")

    title_tag = soup.find("title")
    if title_tag is None:
        print("  No title found, skipping")
        continue

    title = title_tag.get_text().strip()
    sanitized_title = re.sub(r"[\\/*?:\"<>|]", "_", title)

    img_tag = soup.find("img")
    if img_tag is None:
        print("  No image tag found, skipping")
        continue

    img_src = img_tag.get("src")
    if not img_src:
        print("  Image src missing, skipping")
        continue

    img_url = urllib.parse.urljoin(page_url, img_src)
    try:
        img_resp = requests.get(img_url, headers={"User-Agent": "Mozilla/5.0"})
        img_resp.raise_for_status()
    except Exception as e:
        print(f"  Failed to download image: {e}")
        continue

    try:
        image = Image.open(io.BytesIO(img_resp.content)).convert("RGB")
        out_path = os.path.join(OUTPUT_DIR, f"{sanitized_title}.jpeg")
        image.save(out_path, format="JPEG")
        print(f"  Saved {out_path}")
    except Exception as e:
        print(f"  Failed to save image: {e}")
