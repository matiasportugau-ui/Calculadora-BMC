import React, { useState, useRef, useEffect } from "react";

export default function Radio() {
  const [isOn, setIsOn] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isOn) {
        audioRef.current.play().catch(() => {
          // Autoplay might be blocked by browser; user can enable audio by clicking
        });
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [isOn]);

  const toggleRadio = () => {
    setIsOn(!isOn);
  };

  return (
    <>
      {/* Audio element for soundtrack */}
      <audio
        ref={audioRef}
        src="/audio/panelin.mp3"
        loop
        playsInline
      />

      {/* Radio container - bottom right corner */}
      <div
        onClick={toggleRadio}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          cursor: "pointer",
          transition: "transform 0.2s ease",
          transform: "scale(1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {isOn ? (
          // Radio ON - show video
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: 120,
              height: 120,
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              background: "#000",
              objectFit: "cover",
            }}
          >
            <source src="/videos/radio-on.mp4" type="video/mp4" />
          </video>
        ) : (
          // Radio OFF - show static image/placeholder
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 12,
              background: "rgba(15, 23, 42, 0.8)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#cbd5e1",
              fontSize: 14,
              fontWeight: 500,
              textAlign: "center",
              padding: 8,
              backdropFilter: "blur(10px)",
            }}
          >
            📻
          </div>
        )}
      </div>
    </>
  );
}
