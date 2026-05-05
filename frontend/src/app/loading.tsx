export default function RootLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "hsl(210, 38%, 98%)",
        fontFamily: "'Public Sans', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            margin: "0 auto 16px",
            border: "3px solid hsl(216, 19%, 86%)",
            borderTopColor: "hsl(221, 57%, 19%)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p
          style={{
            fontSize: 14,
            color: "hsl(215, 14%, 41%)",
            fontWeight: 500,
          }}
        >
          Loading platform…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
