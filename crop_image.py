from PIL import Image

def crop_image(input_path, output_path, crop_height):
    try:
        img = Image.open(input_path)
        width, height = img.size
        # Crop the top 'crop_height' pixels
        area = (0, crop_height, width, height)
        cropped_img = img.crop(area)
        cropped_img.save(output_path)
        print(f"Successfully cropped image to {output_path}")
    except Exception as e:
        print(f"Error cropping image: {e}")

if __name__ == "__main__":
    crop_image('assets/images/vendors-compliant.png', 'assets/images/vendors-compliant-cropped.png', 100)
