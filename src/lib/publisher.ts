import { decrypt } from "@/lib/crypto";
import type { SocialAccount } from "@/db/schema";

export type PublishResult = {
  success: boolean;
  externalUrl?: string;
  errorMessage?: string;
};

export async function publishToPlatform(
  post: {
    title: string;
    caption?: string;
    hashtags?: string[];
    mediaType?: "video" | "image" | "short" | "text";
    mediaUrl?: string | null;
  },
  account: SocialAccount
): Promise<PublishResult> {
  const isMock = account.isMock || !account.accessTokenEnc;

  if (isMock) {
    return {
      success: true,
      externalUrl: `https://${account.platform}.com/${account.username}/p/${Date.now()}`,
    };
  }

  if (!account.accessTokenEnc) {
    return {
      success: false,
      errorMessage: "Token akses tidak tersedia.",
    };
  }

  const token = decrypt(account.accessTokenEnc);
  if (!token) {
    return {
      success: false,
      errorMessage: "Token akses tidak valid atau gagal didekripsi.",
    };
  }

  const fullText = [
    post.title,
    post.caption,
    (post.hashtags || []).map((h) => `#${h}`).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");

  switch (account.platform) {
    case "facebook": {
      try {
        // Ambil daftar Halaman (Page) yang dikelola pengguna
        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${token}`
        );
        const pagesJson = await pagesRes.json();

        if (pagesJson.error) {
          return {
            success: false,
            errorMessage: `Meta API: ${pagesJson.error.message} (Pastikan izin 'pages_manage_posts' aktif di Facebook Developer).`,
          };
        }

        const pages = pagesJson.data as Array<{ id: string; name: string; access_token: string }>;
        if (!pages || pages.length === 0) {
          return {
            success: false,
            errorMessage:
              "Meta melarang posting ke Profil Pribadi (aturan resmi Facebook sejak 2018). Untuk memposting otomatis, Anda harus membuat Halaman Facebook (Page) dan menautkannya ke akun Facebook ini.",
          };
        }

        // Gunakan halaman yang sesuai dengan akun atau halaman pertama
        const targetPage =
          pages.find((p) => p.id === account.externalId) || pages[0];
        const pageId = targetPage.id;
        const pageToken = targetPage.access_token;

        // Jika ada media gambar berupa Data URL
        if (post.mediaUrl && post.mediaUrl.startsWith("data:image/")) {
          const [header, base64Data] = post.mediaUrl.split(",");
          const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
          const buffer = Buffer.from(base64Data, "base64");
          const blob = new Blob([buffer], { type: mimeType });

          const formData = new FormData();
          formData.append("access_token", pageToken);
          formData.append("caption", fullText);
          formData.append("source", blob, "upload.jpg");

          const photoRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/photos`,
            {
              method: "POST",
              body: formData,
            }
          );
          const photoJson = await photoRes.json();
          if (!photoRes.ok || photoJson.error) {
            return {
              success: false,
              errorMessage:
                photoJson.error?.message || "Gagal mengunggah foto ke Halaman Facebook.",
            };
          }

          const fbPostId = photoJson.post_id || photoJson.id;
          return {
            success: true,
            externalUrl: `https://facebook.com/${fbPostId}`,
          };
        }

        // Publikasi feed/status teks biasa ke Facebook Page
        const feedRes = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}/feed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: fullText,
              access_token: pageToken,
            }),
          }
        );
        const feedJson = await feedRes.json();
        if (!feedRes.ok || feedJson.error) {
          return {
            success: false,
            errorMessage:
              feedJson.error?.message || "Gagal memposting status ke Halaman Facebook.",
          };
        }

        return {
          success: true,
          externalUrl: `https://facebook.com/${feedJson.id}`,
        };
      } catch (err) {
        return {
          success: false,
          errorMessage: (err as Error).message || "Terjadi kesalahan koneksi ke Meta Graph API.",
        };
      }
    }

    default: {
      return {
        success: true,
        externalUrl: `https://${account.platform}.com/${account.username}/p/${Date.now()}`,
      };
    }
  }
}
