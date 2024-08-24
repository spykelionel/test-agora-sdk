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

  let localTracks = {
    audioTrack: null,
    videoTrack: null,
    screenTrack: null,
  };

  const waitForConnectionState = (connectionState) => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (client.connectionState === connectionState) {
          clearInterval(interval);
          resolve();
        }
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Connection state timeout"));
      }, 10000);
    });
  };

  const connect = async (onTrackPublished, onUserDisconnected) => {
    try {
      await waitForConnectionState("DISCONNECTED");
      const uid = await client.join(APP_ID, CHANNEL, TOKEN, null);

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        onTrackPublished(user, mediaType);
      });

      client.on("user-left", onUserDisconnected);

      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();
      localTracks.audioTrack = audioTrack;
      localTracks.videoTrack = videoTrack;
      await client.publish([audioTrack, videoTrack]);

      return { uid };
    } catch (error) {
      console.error("Failed to connect:", error);
      throw error;
    }
  };

  const startScreenShare = async () => {
    try {
      localTracks.screenTrack = await AgoraRTC.createScreenVideoTrack();
      await client.unpublish(localTracks.videoTrack);
      await client.publish(localTracks.screenTrack);
      return localTracks.screenTrack;
    } catch (error) {
      console.error("Failed to start screen share:", error);
      throw error;
    }
  };

  const stopScreenShare = async () => {
    if (localTracks.screenTrack) {
      await client.unpublish(localTracks.screenTrack);
      localTracks.screenTrack.stop();
      localTracks.screenTrack = null;
      await client.publish(localTracks.videoTrack);
    }
  };

  const disconnect = async () => {
    try {
      await waitForConnectionState("CONNECTED");
      client.removeAllListeners();
      for (let track of Object.values(localTracks)) {
        if (track) {
          track.stop();
          track.close();
        }
      }
      await client.unpublish(Object.values(localTracks).filter(Boolean));
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
    client,
    localTracks,
  };
};

const agoraClient = createAgoraClient();

export const VideoRoom = () => {
  const [users, setUsers] = useState([]);
  const [localUid, setLocalUid] = useState(null);

  const onTrackPublished = useCallback((user, mediaType) => {
    setUsers((prevUsers) => {
      const existingUser = prevUsers.find((u) => u.uid === user.uid);
      if (existingUser) {
        return prevUsers.map((u) =>
          u.uid === user.uid ? { ...u, [mediaType]: user[mediaType] } : u
        );
      } else {
        return [...prevUsers, user];
      }
    });
  }, []);

  const onUserDisconnected = useCallback((user) => {
    setUsers((prevUsers) => prevUsers.filter((u) => u.uid !== user.uid));
  }, []);

  useEffect(() => {
    const setup = async () => {
      try {
        const { uid } = await agoraClient.connect(
          onTrackPublished,
          onUserDisconnected
        );
        setLocalUid(uid);
        setUsers((prevUsers) => [
          ...prevUsers,
          {
            uid,
            audioTrack: agoraClient.localTracks.audioTrack,
            videoTrack: agoraClient.localTracks.videoTrack,
          },
        ]);
      } catch (error) {
        console.error("Setup failed:", error);
      }
    };

    const cleanup = async () => {
      try {
        await agoraClient.disconnect();
        setLocalUid(null);
        setUsers([]);
      } catch (error) {
        console.error("Cleanup failed:", error);
      }
    };

    agoraCommandQueue = agoraCommandQueue.then(setup);

    return () => {
      agoraCommandQueue = agoraCommandQueue.then(cleanup);
    };
  }, [onTrackPublished, onUserDisconnected]);

  const handleStartScreenShare = async () => {
    try {
      const screenTrack = await agoraClient.startScreenShare();
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.uid === localUid ? { ...user, videoTrack: screenTrack } : user
        )
      );
    } catch (error) {
      console.error("Failed to start screen share:", error);
    }
  };

  const handleStopScreenShare = async () => {
    try {
      await agoraClient.stopScreenShare();
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.uid === localUid
            ? { ...user, videoTrack: agoraClient.localTracks.videoTrack }
            : user
        )
      );
    } catch (error) {
      console.error("Failed to stop screen share:", error);
    }
  };

  const isScreenSharing =
    users.find((user) => user.uid === localUid)?.videoTrack ===
    agoraClient.localTracks.screenTrack;

  return (
    <>
      <div>User ID: {localUid}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
          }}
        >
          {users.map((user) => (
            <VideoPlayer key={user.uid} user={user} />
          ))}
        </div>
      </div>
      <button onClick={handleStartScreenShare} disabled={isScreenSharing}>
        Start Screen Share
      </button>
      <button onClick={handleStopScreenShare} disabled={!isScreenSharing}>
        Stop Screen Share
      </button>
    </>
  );
};
