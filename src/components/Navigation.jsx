import React from "react";

const LOGO_URL = "https://upload.wikimedia.org/wikipedia/tr/1/19/2026_FIFA_D%C3%BCnya_Kupas%C4%B1.svg";

export default function Navigation({ activeTab, setActiveTab, onResetAll }) {
  // Menü elemanlarının tanımı
  const menuItems = [
    { id: "groups", label: "GRUP AŞAMASI", icon: "⚽" },
    { id: "knockout", label: "ELEME TURLARI", icon: "🏆" },
    { id: "stats", label: "İSTATİSTİKLER & MATRİS", icon: "📊" },
    { id: "elo", label: "TAKIM GÜÇLERİ (ELO)", icon: "⚙️" },
  ];

  return (
    <header style={{
      background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      padding: "12px 20px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)"
    }}>
      <div style={{
        maxWidth: 1440,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
        flexWrap: "wrap"
      }}>
        
        {/* LOGO VE BAŞLIK ALANI */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img 
            src={LOGO_URL} 
            alt="FIFA 2026 Logo" 
            style={{ width: 40, height: 40, objectFit: "contain" }} 
          />
          <div>
            <h1 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fbbf24", letterSpacing: "0.05em" }}>
              WORLD CUP 2026
            </h1>
            <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>
              Simülasyon & Tahmin Portalı
            </p>
          </div>
        </div>

        {/* NAVİGASYON BUTONLARI */}
        <nav style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  background: isActive ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" : "rgba(255, 255, 255, 0.03)",
                  border: isActive ? "1px solid #60a5fa" : "1px solid rgba(255, 255, 255, 0.05)",
                  color: isActive ? "#ffffff" : "#cbd5e1",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease-in-out",
                  boxShadow: isActive ? "0 4px 12px rgba(59, 130, 246, 0.3)" : "none"
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* EYLEMLER ALANI (SIFIRLAMA BUTONU) */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={onResetAll}
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
              border: "1px solid #f87171",
              color: "#ffffff",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              letterSpacing: "0.03em",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
              transition: "transform 0.1s ease"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
          >
            Turnuvayı Sıfırla 🔄
          </button>
        </div>

      </div>
    </header>
  );
}