import React, { useEffect, useRef } from "react";

export const VideoPlayer = ({ user, fullWidth, small }) => {
  const ref = useRef();

  useEffect(() => {
    if (!user.videoTrack) return;

    const playTrack = async () => {
      try {
        if (ref.current.childNodes.length > 0) {
          ref.current.removeChild(ref.current.childNodes[0]);
        }
        await user.videoTrack.play(ref.current);
      } catch (error) {
        console.error("Error playing video track:", error);
      }
    };

    playTrack();

    return () => {
      if (user.videoTrack) {
        user.videoTrack.stop();
      }
    };
  }, [user.videoTrack]);

  const style = fullWidth
    ? {
        width: "100%",
        height: "100%",
        objectFit: "contain",
        border: "1px solid red",
      }
    : small
    ? {
        width: "120px",
        height: "90px",
        overflow: "hidden",
        border: "1px solid red",
      }
    : {
        width: "200px",
        height: "200px",
        overflow: "hidden",
        border: "1px solid red",
      };

  return (
    <>
      <p> user: {user?.uid}</p>
      <div ref={ref} style={style}></div>
    </>
  );
};
