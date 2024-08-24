import React, { useEffect, useRef } from "react";

export const VideoPlayer = ({ user }) => {
  const ref = useRef();

  useEffect(() => {
    if (!user.videoTrack) return;

    const playTrack = async () => {
      try {
        // If there's an existing video element, remove it
        if (ref.current.childNodes.length > 0) {
          ref.current.removeChild(ref.current.childNodes[0]);
        }
        // Play the new track
        await user.videoTrack.play(ref.current);
      } catch (error) {
        console.error("Error playing video track:", error);
      }
    };

    playTrack();

    // Cleanup function
    return () => {
      if (user.videoTrack) {
        user.videoTrack.stop();
      }
    };
  }, [user.videoTrack]); // Re-run effect when videoTrack changes

  return (
    <div
      ref={ref}
      style={{ width: "200px", height: "200px", overflow: "hidden" }}
    ></div>
  );
};
