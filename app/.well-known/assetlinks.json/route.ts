export async function GET() {
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.vercel.lendz_theta.twa",
        sha256_cert_fingerprints: [
          "8D:BE:BA:98:58:C0:8D:22:81:69:D2:29:D7:C5:82:0B:CA:4B:95:CF:F6:A9:FB:C8:8C:BE:71:9D:D2:78:59:77",
        ],
      },
    },
  ];

  return Response.json(assetlinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
