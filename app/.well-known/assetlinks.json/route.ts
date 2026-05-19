export async function GET() {
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.vercel.lendz_theta.twa",
        sha256_cert_fingerprints: [
          "BA:26:FE:CE:05:B5:E3:2F:D9:29:5A:E9:CF:31:4E:41:E3:65:5B:A6:55:7C:87:76:49:E1:CE:24:B0:E5:C4:AD",
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
