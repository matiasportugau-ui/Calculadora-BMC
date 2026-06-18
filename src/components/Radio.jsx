import React, { useState, useRef, useEffect } from "react";

export default function Radio() {
  const [isOn, setIsOn] = useState(true);
  const [imgError, setImgError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isOn) {
        audioRef.current.play().catch(() => {
          setIsOn(false);
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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleRadio();
    }
  };

  return (
    <>
      {/* Audio element for soundtrack */}
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/panelin.mp3`}
        loop
      />

      {/* Radio container - bottom left corner */}
      <div
        role="button"
        tabIndex={0}
        aria-label={isOn ? "Radio is on" : "Radio is off"}
        aria-pressed={isOn}
        onClick={toggleRadio}
        onKeyDown={handleKeyDown}
        style={{
          position: "fixed",
          bottom: 24,
          left: 24,
          zIndex: 9999,
          cursor: "pointer",
          transition: "transform 0.2s ease",
          transform: "scale(1)",
          outline: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onFocus={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onBlur={(e) => {
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
            <source src={`${import.meta.env.BASE_URL}videos/radio-on.mp4`} type="video/mp4" />
          </video>
        ) : imgError ? (
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
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}images/radio-off.jpg`}
              alt="Radio off"
              style={{
                width: 120,
                height: 120,
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                objectFit: "cover",
                background: "rgba(15, 23, 42, 0.8)",
              }}
              onError={() => setImgError(true)}
            />
          )}
      </div>
    </>
  );
}
