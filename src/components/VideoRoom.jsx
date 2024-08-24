import AgoraRTC from "agora-rtc-sdk-ng";
import React, { useCallback, useEffect, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";

const APP_ID = process.env.REACT_APP_APP_ID;
const TOKEN = process.env.REACT_APP_TOKEN;
const CHANNEL = "Test-Channel";

AgoraRTC.setLogLevel(3);

let agoraCommandQueue = Promise.resolve();

const createAgoraClient = () => {
  const client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8",
  });

  let tracks = [];
  let screenTrack = null;

  const waitForConnectionState = (connectionState) => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (client.connectionState === connectionState) {
          clearInterval(interval);
          resolve();
        }
      }, 200);

      // Add a timeout to prevent potential memory leaks
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Connection state timeout"));
      }, 10000);
    });
  };

  const connect = async (onVideoTrack, onUserDisconnected) => {
    try {
      await waitForConnectionState("DISCONNECTED");
      const uid = await client.join(APP_ID, CHANNEL, TOKEN, null);

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          onVideoTrack(user);
        }
      });

      client.on("user-left", onUserDisconnected);

      tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
      await client.publish(tracks);

      return { tracks, uid };
    } catch (error) {
      console.error("Failed to connect:", error);
      throw error;
    }
  };

  const startScreenShare = async () => {
    try {
      screenTrack = await AgoraRTC.createScreenVideoTrack();
      await client.publish(screenTrack);
      return screenTrack;
    } catch (error) {
      console.error("Failed to start screen share:", error);
      throw error;
    }
  };

  const stopScreenShare = async () => {
    if (screenTrack) {
      await client.unpublish(screenTrack);
      screenTrack.stop();
      screenTrack.close();
      screenTrack = null;
    }
  };

  const disconnect = async () => {
    try {
      await waitForConnectionState("CONNECTED");
      client.removeAllListeners();
      for (let track of tracks) {
        track.stop();
        track.close();
      }
      await client.unpublish(tracks);
      await client.leave();
    } catch (error) {
      console.error("Failed to disconnect:", error);
      throw error;
    }
  };

  return {
    connect,
    disconnect,
    startScreenShare,
    stopScreenShare,
  };
};

const agoraClient = createAgoraClient();

export const VideoRoom = () => {
  const [users, setUsers] = useState([]);
  const [uid, setUid] = useState(null);
  const [screenTrack, setScreenTrack] = useState(null);

  const onVideoTrack = useCallback((user) => {
    setUsers((previousUsers) => [...previousUsers, user]);
  }, []);

  const onUserDisconnected = useCallback((user) => {
    setUsers((previousUsers) =>
      previousUsers.filter((u) => u.uid !== user.uid)
    );
  }, []);

  useEffect(() => {
    const setup = async () => {
      try {
        const { tracks, uid } = await agoraClient.connect(
          onVideoTrack,
          onUserDisconnected
        );
        setUid(uid);
        setUsers((previousUsers) => [
          ...previousUsers,
          {
            uid,
            audioTrack: tracks[0],
            videoTrack: tracks[1],
          },
        ]);
      } catch (error) {
        console.error("Setup failed:", error);
      }
    };

    const cleanup = async () => {
      try {
        await agoraClient.disconnect();
        setUid(null);
        setUsers([]);
      } catch (error) {
        console.error("Cleanup failed:", error);
      }
    };

    agoraCommandQueue = agoraCommandQueue.then(setup);

    return () => {
      agoraCommandQueue = agoraCommandQueue.then(cleanup);
    };
  }, [onVideoTrack, onUserDisconnected]);

  const handleStartScreenShare = async () => {
    try {
      const track = await agoraClient.startScreenShare();
      setScreenTrack(track);
    } catch (error) {
      console.error("Failed to start screen share:", error);
    }
  };

  const handleStopScreenShare = async () => {
    try {
      await agoraClient.stopScreenShare();
      setScreenTrack(null);
    } catch (error) {
      console.error("Failed to stop screen share:", error);
    }
  };

  return (
    <>
      <div>User ID: {uid}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 400px)",
          }}
        >
          {users.map((user) => (
            <VideoPlayer key={user.uid} user={user} />
          ))}
        </div>
      </div>
      {screenTrack && <VideoPlayer user={{ videoTrack: screenTrack }} />}
      <button onClick={handleStartScreenShare} disabled={!!screenTrack}>
        Start Screen Share
      </button>
      <button onClick={handleStopScreenShare} disabled={!screenTrack}>
        Stop Screen Share
      </button>
    </>
  );
};
