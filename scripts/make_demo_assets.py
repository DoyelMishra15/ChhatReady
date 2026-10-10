#!/usr/bin/env python3
"""
Generates the synthetic SAMPLE electricity bill and SAMPLE installer quote used by the demo,
plus matching extraction fixtures (with bounding boxes) for MOCK_AWS mode.

All names and numbers are fictional. Run: python3 scripts/make_demo_assets.py   (needs Pillow)
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT_PUBLIC = os.path.join(ROOT, "apps", "web", "public", "demo")
OUT_FIX = os.path.join(ROOT, "demo", "fixtures")
os.makedirs(OUT_PUBLIC, exist_ok=True)
os.makedirs(OUT_FIX, exist_ok=True)

W, H = 1240, 1754
FONT_DIRS = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu", "/Library/Fonts"]


def font(size, bold=False):
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for d in FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


INK = (24, 32, 28)
MUTED = (96, 108, 100)
GREEN = (11, 107, 79)
LINE = (210, 205, 190)
PAPER = (253, 252, 248)


def bbox_of(draw, xy, text, fnt):
    l, t, r, b = draw.textbbox(xy, text, font=fnt)
    pad = 6
    return {
        "left": max(0, (l - pad) / W),
        "top": max(0, (t - pad) / H),
        "width": (r - l + 2 * pad) / W,
        "height": (b - t + 2 * pad) / H,
    }


def watermark(img):
    d = ImageDraw.Draw(img)
    d.text((W - 40, 28), "SAMPLE · FICTIONAL · FOR DEMO ONLY", font=font(18, True), fill=(180, 60, 40), anchor="ra")


def make_bill():
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    lines = []
    boxes = {}

    d.rectangle([0, 0, W, 190], fill=GREEN)
    title = "Sample Power Distribution Co. Ltd."
    d.text((60, 52), title, font=font(46, True), fill=(255, 255, 255))
    boxes["discom"] = bbox_of(d, (60, 52), title, font(46, True))
    lines.append(title)
    sub = "Electricity Bill  |  Low Tension Domestic"
    d.text((60, 118), sub, font=font(26), fill=(220, 240, 232))
    lines.append(sub)
    watermark(img)

    y = 250
    f_l = font(26)
    f_v = font(30, True)

    def row(label, value, key=None, y0=None, x_val=470):
        nonlocal y
        yy = y if y0 is None else y0
        d.text((60, yy), label, font=f_l, fill=MUTED)
        d.text((x_val, yy), value, font=f_v, fill=INK)
        if key:
            boxes[key] = bbox_of(d, (x_val, yy), value, f_v)
        lines.append(f"{label} {value}")
        y = yy + 58

    row("Consumer Number", "4821093755", "consumerNumber")
    row("Billing Period", "Monthly", "billingPeriod")
    row("Tariff Category", "LT Domestic (Single Phase)", "tariffCategory")
    row("Sanctioned Load", "4.0 kW", "sanctionedLoadKw")
    row("Meter Number", "SM-77120456")

    y += 20
    d.line([60, y, W - 60, y], fill=LINE, width=3)
    y += 30
    d.text((60, y), "Consumption Details", font=font(30, True), fill=GREEN)
    lines.append("Consumption Details")
    y += 64
    row("Previous Reading", "10,482 kWh")
    row("Current Reading", "10,767 kWh")
    row("Units Consumed", "285 kWh", "unitsMonth")

    y += 20
    d.line([60, y, W - 60, y], fill=LINE, width=3)
    y += 30
    d.text((60, y), "Charges", font=font(30, True), fill=GREEN)
    lines.append("Charges")
    y += 64
    for label, val in [
        ("Energy Charges", "₹ 1,842.50"),
        ("Fixed Charges", "₹ 260.00"),
        ("Electricity Duty", "₹ 164.10"),
        ("Fuel Surcharge", "₹ 146.00"),
    ]:
        d.text((60, y), label, font=f_l, fill=MUTED)
        d.text((W - 60, y), val, font=f_l, fill=INK, anchor="ra")
        lines.append(f"{label} {val}")
        y += 52
    y += 14
    d.rectangle([60, y, W - 60, y + 110], fill=(227, 242, 235), outline=GREEN, width=3)
    d.text((90, y + 36), "Net Amount Payable", font=font(32, True), fill=GREEN)
    amt = "₹ 2,412.60"
    d.text((W - 90, y + 28), amt, font=font(46, True), fill=INK, anchor="ra")
    lines.append("Net Amount Payable")
    lines.append(amt)
    bx = d.textbbox((W - 90, y + 28), amt, font=font(46, True), anchor="ra")
    boxes["amountMonth"] = {
        "left": (bx[0] - 8) / W,
        "top": (bx[1] - 8) / H,
        "width": (bx[2] - bx[0] + 16) / W,
        "height": (bx[3] - bx[1] + 16) / H,
    }
    y += 160
    d.text((60, y), "This is a synthetic sample bill generated for demonstration. Not a real document.", font=font(20), fill=MUTED)
    lines.append("This is a synthetic sample bill generated for demonstration. Not a real document.")

    img.save(os.path.join(OUT_PUBLIC, "sample-bill.png"), optimize=True)

    def fv(v, conf, key):
        return {"value": v, "confidence": conf, "bbox": boxes.get(key)}

    fixture = {
        "fields": {
            "discom": fv("Sample Power Distribution Co. Ltd.", 0.97, "discom"),
            "consumerNumber": fv("4821093755", 0.99, "consumerNumber"),
            "billingPeriod": fv("Monthly", 0.95, "billingPeriod"),
            "tariffCategory": fv("LT Domestic (Single Phase)", 0.93, "tariffCategory"),
            "unitsMonth": fv(285, 0.98, "unitsMonth"),
            "amountMonth": fv(2412.6, 0.97, "amountMonth"),
            "sanctionedLoadKw": fv(4.0, 0.74, "sanctionedLoadKw"),
        },
        "lines": lines,
    }
    with open(os.path.join(OUT_FIX, "sample-bill.extract.json"), "w") as f:
        json.dump(fixture, f, indent=2, ensure_ascii=False)


def make_quote():
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    lines = []
    boxes = {}
    d.rectangle([0, 0, W, 170], fill=(30, 41, 59))
    t = "Sample Solar Installers"
    d.text((60, 44), t, font=font(46, True), fill=(255, 255, 255))
    lines.append(t)
    s = "Quotation for Rooftop Solar PV System (fictional installer)"
    d.text((60, 108), s, font=font(24), fill=(210, 220, 235))
    lines.append(s)
    watermark(img)

    y = 220
    f_l, f_v = font(26), font(28, True)
    for label, val in [("Quotation No.", "SSI/0417"), ("Customer", "Sample Household")]:
        d.text((60, y), label, font=f_l, fill=MUTED)
        d.text((380, y), val, font=f_v, fill=INK)
        lines.append(f"{label} {val}")
        y += 52

    y += 20
    d.line([60, y, W - 60, y], fill=LINE, width=3)
    y += 28
    d.text((60, y), "Scope and specification", font=font(30, True), fill=(30, 41, 59))
    lines.append("Scope and specification")
    y += 62

    cap = "3 kW On-grid Rooftop Solar System"
    d.text((60, y), cap, font=font(32, True), fill=INK)
    boxes["systemKw"] = bbox_of(d, (60, y), cap, font(32, True))
    lines.append(cap)
    y += 66

    pan = "Solar panels: 540 Wp Mono PERC x 6 nos."
    d.text((60, y), pan, font=font(28), fill=INK)
    boxes["panels"] = bbox_of(d, (60, y), pan, font(28))
    lines.append(pan)
    y += 52
    inv = "Inverter: 3 kW on-grid string inverter"
    d.text((60, y), inv, font=font(28), fill=INK)
    boxes["inverter"] = bbox_of(d, (60, y), inv, font(28))
    lines.append(inv)
    y += 52
    for extra in ["Mounting structure: hot-dip galvanised", "DC/AC cabling, earthing and lightning arrestor", "Installation and commissioning"]:
        d.text((60, y), extra, font=font(28), fill=INK)
        lines.append(extra)
        y += 52

    y += 24
    war = "Warranty: Panels 25 years performance, inverter 5 years"
    d.text((60, y), war, font=font(28), fill=INK)
    boxes["warranty"] = bbox_of(d, (60, y), war, font(28))
    lines.append(war)
    y += 80

    d.rectangle([60, y, W - 60, y + 120], fill=(235, 240, 248), outline=(30, 41, 59), width=3)
    d.text((90, y + 40), "Total price (inclusive of GST)", font=font(30, True), fill=(30, 41, 59))
    price = "₹ 2,25,000"
    d.text((W - 90, y + 32), price, font=font(48, True), fill=INK, anchor="ra")
    lines.append("Total price (inclusive of GST)")
    lines.append(price)
    bx = d.textbbox((W - 90, y + 32), price, font=font(48, True), anchor="ra")
    boxes["totalPrice"] = {
        "left": (bx[0] - 8) / W,
        "top": (bx[1] - 8) / H,
        "width": (bx[2] - bx[0] + 16) / W,
        "height": (bx[3] - bx[1] + 16) / H,
    }
    y += 170
    for tline in ["Payment: 50% advance, 50% on commissioning.", "Validity: 15 days from the date of quotation."]:
        d.text((60, y), tline, font=font(24), fill=MUTED)
        lines.append(tline)
        y += 44
    d.text((60, y + 30), "Synthetic sample quotation for demonstration. Not a real offer.", font=font(20), fill=MUTED)
    lines.append("Synthetic sample quotation for demonstration. Not a real offer.")

    img.save(os.path.join(OUT_PUBLIC, "sample-quote.png"), optimize=True)

    def fv(v, conf, key):
        return {"value": v, "confidence": conf, "bbox": boxes.get(key)}

    fixture = {
        "fields": {
            "totalPrice": fv(225000, 0.96, "totalPrice"),
            "systemKw": fv(3, 0.95, "systemKw"),
            "panels": fv("540 Wp Mono PERC x 6 nos.", 0.9, "panels"),
            "inverter": fv("3 kW on-grid string inverter", 0.9, "inverter"),
            "warranty": fv("Panels 25 years performance, inverter 5 years", 0.88, "warranty"),
        },
        "lines": lines,
    }
    with open(os.path.join(OUT_FIX, "sample-quote.extract.json"), "w") as f:
        json.dump(fixture, f, indent=2, ensure_ascii=False)


def write_hashes():
    import hashlib
    def sha(path):
        with open(path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()
    with open(os.path.join(OUT_FIX, "sample-hashes.json"), "w") as f:
        json.dump({
            "bill": sha(os.path.join(OUT_PUBLIC, "sample-bill.png")),
            "quote": sha(os.path.join(OUT_PUBLIC, "sample-quote.png")),
        }, f, indent=2)


if __name__ == "__main__":
    make_bill()
    make_quote()
    write_hashes()
    print("Wrote demo assets to", OUT_PUBLIC, "and", OUT_FIX)
