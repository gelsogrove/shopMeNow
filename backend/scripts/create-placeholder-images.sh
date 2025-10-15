#!/bin/bash
# Script to create placeholder images for products and services

# Create placeholder image function
create_placeholder() {
    local code=$1
    local type=$2
    local output_dir=$3
    local filename="${code}.jpg"
    local output_path="${output_dir}/${filename}"
    
    # Use ImageMagick to create a simple placeholder (if installed)
    # Otherwise, create an empty file as placeholder
    if command -v convert &> /dev/null; then
        convert -size 400x400 xc:lightgray \
            -gravity center \
            -pointsize 30 \
            -draw "text 0,0 '${code}'" \
            "$output_path"
        echo "Created placeholder image: $output_path"
    else
        # Create empty placeholder file
        touch "$output_path"
        echo "Created placeholder file: $output_path (install ImageMagick for actual images)"
    fi
}

# Create products placeholders
PRODUCTS_DIR="uploads/products"
mkdir -p "$PRODUCTS_DIR"

echo "Creating product placeholders..."
create_placeholder "PASTA001" "product" "$PRODUCTS_DIR"
create_placeholder "SALUMI001" "product" "$PRODUCTS_DIR"
create_placeholder "FORMAG001" "product" "$PRODUCTS_DIR"
create_placeholder "COND001" "product" "$PRODUCTS_DIR"
create_placeholder "DOLCI001" "product" "$PRODUCTS_DIR"
create_placeholder "BEV001" "product" "$PRODUCTS_DIR"
create_placeholder "SPEC001" "product" "$PRODUCTS_DIR"
create_placeholder "SOTT001" "product" "$PRODUCTS_DIR"

# Create services placeholders
SERVICES_DIR="uploads/services"
mkdir -p "$SERVICES_DIR"

echo "Creating service placeholders..."
create_placeholder "SHP001" "service" "$SERVICES_DIR"
create_placeholder "GFT001" "service" "$SERVICES_DIR"

echo "Done! Placeholder images created."
