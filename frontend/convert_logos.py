import fitz
import os

def extract_pdf_to_img(pdf_path, img_path):
    print(f"Opening {pdf_path}")
    doc = fitz.open(pdf_path)
    page = doc[0]
    # Use a high resolution (zoom factor)
    zoom = 4
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    pix.save(img_path)
    print(f"Saved {img_path}")

base_dir = r"c:\Users\ahmet\Desktop\E-TİCARET KPI DASHBOARD"
frontend_public = os.path.join(base_dir, "frontend", "public")

extract_pdf_to_img(
    os.path.join(base_dir, "sporthink-logo-blk 4.pdf"),
    os.path.join(frontend_public, "sporthink-logo-blk.png")
)

extract_pdf_to_img(
    os.path.join(base_dir, "sporthink-logo-disi 8.pdf"),
    os.path.join(frontend_public, "sporthink-logo-disi.png")
)
