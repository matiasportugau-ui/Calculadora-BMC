import sys
from PIL import Image

def extract_signature(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    
    # The signature is in the bottom-left corner.
    # Let's crop the bottom left 200x200 pixels.
    box = (0, h - 200, 200, h)
    cropped = img.crop(box)
    
    data = cropped.getdata()
    new_data = []
    
    for r, g, b, a in data:
        # Calculate grayscale intensity (255=white, 0=black)
        intensity = int((r + g + b) / 3)
        
        if intensity > 200:
            new_data.append((0, 0, 0, 0))  # fully transparent
        else:
            # Map dark pixels to solid dark color
            alpha = min(255, int((255 - intensity) * 1.5))
            new_data.append((40, 40, 40, alpha))
            
    cropped.putdata(new_data)
    cropped.save(output_path, "PNG")

if __name__ == "__main__":
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    extract_signature(input_file, output_file)