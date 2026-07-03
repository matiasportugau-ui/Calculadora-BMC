export function parseShopifyProduct(shopifyProduct) {
  try {
    if (!shopifyProduct) return { images: [], specs: {}, features: [] };

    const images = parseImages(shopifyProduct);
    const specs = parseSpecs(shopifyProduct);
    const features = parseFeatures(shopifyProduct);

    return { images, specs, features };
  } catch (error) {
    console.error("Error parsing Shopify product:", error);
    return { images: [], specs: {}, features: [] };
  }
}

function parseImages(product) {
  try {
    if (!product?.images || !Array.isArray(product.images)) {
      return [];
    }

    return product.images.map((img, idx) => ({
      id: img.id || `image-${idx}`,
      src: img.src || "",
      alt: img.alt || product.title || "Product image",
      title: img.alt || `Image ${idx + 1}`,
    })).filter((img) => img.src);
  } catch (error) {
    console.error("Error parsing images:", error);
    return [];
  }
}

function parseSpecs(product) {
  try {
    const specs = {
      family: "N/A",
      material: "N/A",
      thickness: "N/A",
      width: "N/A",
      height: "N/A",
      weight: "N/A",
    };

    // Extract from first variant title (SKU format)
    const variantTitle = product?.variants?.[0]?.title;
    if (variantTitle) {
      // Pattern: FAMILY-MATERIAL-THICKNESSmmxWIDTHxHEIGHT-WEIGHTkg
      // Example: "ISODEC-EPS-50mm-1200x2400-32kg"
      const match = variantTitle.match(
        /([A-Z_]+)-([A-Z]+)-(\d+mm).*?(\d+)x(\d+).*?(\d+kg)?/
      );
      if (match) {
        specs.family = match[1] || "N/A";
        specs.material = match[2] || "N/A";
        specs.thickness = match[3] || "N/A";
        specs.width = `${match[4] || "N/A"}mm`;
        specs.height = `${match[5] || "N/A"}mm`;
        if (match[6]) {
          specs.weight = match[6];
        }
      }
    }

    return specs;
  } catch (error) {
    console.error("Error parsing specs:", error);
    return {
      family: "N/A",
      material: "N/A",
      thickness: "N/A",
    };
  }
}

function parseFeatures(product) {
  try {
    const features = [];

    // Try to extract from descriptionHtml <li> tags
    if (product?.descriptionHtml) {
      const liRegex = /<li[^>]*>([^<]+)<\/li>/gi;
      let match;
      while ((match = liRegex.exec(product.descriptionHtml)) !== null) {
        const text = match[1].trim();
        if (text && features.length < 5) {
          features.push(text);
        }
      }
    }

    // Fallback: extract from tags
    if (features.length === 0 && product?.tags) {
      const tagArray = Array.isArray(product.tags)
        ? product.tags
        : typeof product.tags === "string"
          ? product.tags.split(",")
          : [];

      tagArray.forEach((tag) => {
        const cleaned = tag.trim().replace(/-/g, " ");
        if (cleaned && features.length < 4) {
          features.push(cleaned);
        }
      });
    }

    return features;
  } catch (error) {
    console.error("Error parsing features:", error);
    return [];
  }
}
