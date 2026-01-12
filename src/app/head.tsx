export default function Head() {
  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL || "").trim();

  let origin: string | null = null;
  try {
    if (base) origin = new URL(base).origin;
  } catch {
    origin = null;
  }

  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {origin ? (
        <>
          <link rel="dns-prefetch" href={origin} />
          <link rel="preconnect" href={origin} crossOrigin="" />
        </>
      ) : null}
    </>
  );
}
