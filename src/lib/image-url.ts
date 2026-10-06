/**
 * Resized WebP URL for a listing image. Cloudinary URLs get a transformation
 * inserted after /upload/; local stub URLs are returned as they are.
 */
export function imageUrl(url: string, w: number, h?: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  const t = ["f_webp", "q_auto", "c_fill", `w_${w}`, h ? `h_${h}` : null].filter(Boolean).join(",");
  return url.replace("/upload/", `/upload/${t}/`);
}
