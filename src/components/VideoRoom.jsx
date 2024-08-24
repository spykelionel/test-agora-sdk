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
  const [activeUser, setActiveUser] = useState(null);
  const onUserDisconnected = useCallback((user) => {
    setUsers((prevUsers) => prevUsers.filter((u) => u.uid !== user.uid));
  }, []);

  const onTrackPublished = useCallback((user, mediaType) => {
    setUsers((prevUsers) => {
      const existingUser = prevUsers.find((u) => u.uid === user.uid);
      if (existingUser) {
        return prevUsers.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                [mediaType]: user[mediaType],
                videoTrack:
                  mediaType === "video" ? user.videoTrack : u.videoTrack,
                audioTrack:
                  mediaType === "audio" ? user.audioTrack : u.audioTrack,
              }
            : u
        );
      } else {
        return [
          ...prevUsers,
          {
            uid: user.uid,
            videoTrack: mediaType === "video" ? user.videoTrack : null,
            audioTrack: mediaType === "audio" ? user.audioTrack : null,
          },
        ];
      }
    });
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
      setActiveUser({ uid: localUid, videoTrack: screenTrack });
    } catch (error) {
      console.error("Failed to start screen share:", error);
    }
  };

  const handleStopScreenShare = async () => {
    try {
      await agoraClient.stopScreenShare();
      const updatedUsers = users.map((user) =>
        user.uid === localUid
          ? { ...user, videoTrack: agoraClient.localTracks.videoTrack }
          : user
      );
      setUsers(updatedUsers);
      setActiveUser(updatedUsers.find((user) => user.uid === localUid));
    } catch (error) {
      console.error("Failed to stop screen share:", error);
    }
  };

  const isScreenSharing =
    users.find((user) => user.uid === localUid)?.videoTrack ===
    agoraClient.localTracks.screenTrack;

  const handleUserClick = (user) => {
    setActiveUser(user);
  };

  useEffect(() => {
    if (!activeUser && users.length > 0) {
      setActiveUser(users[0]);
    }
  }, [users, activeUser]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Main video area */}
      <div
        style={{ flex: 1, backgroundColor: "#f0f0f0", position: "relative" }}
      >
        {activeUser && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <VideoPlayer user={activeUser} fullWidth />
          </div>
        )}
      </div>

      {/* Bottom user list */}
      <div
        style={{
          height: "150px",
          backgroundColor: "#333",
          padding: "10px",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {users.map((user) => (
          <div
            key={user.uid}
            style={{
              display: "inline-block",
              marginRight: "10px",
              cursor: "pointer",
            }}
            onClick={() => handleUserClick(user)}
          >
            <VideoPlayer user={user} small />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "10px",
          backgroundColor: "#222",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button onClick={handleStartScreenShare} disabled={isScreenSharing}>
          Start Screen Share
        </button>
        <button
          onClick={handleStopScreenShare}
          disabled={!isScreenSharing}
          style={{ marginLeft: "10px" }}
        >
          Stop Screen Share
        </button>
      </div>
    </div>
  );
};
