import { ipcMain } from "electron";
import { api, forgetDevice } from "@main/contexts/p2p-tunnel/infrastructure/DeviceSession";
import * as tunnel from "@main/contexts/p2p-tunnel/infrastructure/TcpTunnel";
import {
  getIceServers,
  loadTurnConfig,
  saveTurnConfig,
  type TurnConfig,
} from "@main/contexts/p2p-tunnel/infrastructure/TurnConfig";

const UUID = /^[0-9a-f-]{36}$/i;

export function registerP2PIPCHandlers(): void {
  ipcMain.handle("p2p:list-groups", () => api("/groups"));
  ipcMain.handle("p2p:create-group", (_e, name: string) =>
    api("/groups", { method: "POST", body: { name } }),
  );
  ipcMain.handle("p2p:join-group", (_e, code: string) =>
    api("/groups/join", { method: "POST", body: { code } }),
  );
  ipcMain.handle("p2p:delete-group", (_e, groupId: string) => {
    if (!UUID.test(groupId)) throw new Error("group_not_found");
    return api(`/groups/${groupId}`, { method: "DELETE" });
  });
  ipcMain.handle("p2p:leave-group", (_e, groupId: string) => {
    if (!UUID.test(groupId)) throw new Error("group_not_found");
    return api(`/groups/${groupId}/membership`, { method: "DELETE" });
  });
  ipcMain.handle("p2p:rotate-invite-code", (_e, groupId: string) => {
    if (!UUID.test(groupId)) throw new Error("group_not_found");
    return api(`/groups/${groupId}/invite-code`, { method: "POST" });
  });
  ipcMain.handle("p2p:remove-member", (_e, groupId: string, userId: string) => {
    if (!UUID.test(groupId) || !UUID.test(userId)) throw new Error("group_not_found");
    return api(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
  });
  ipcMain.handle("p2p:delete-my-data", async () => {
    tunnel.closeAll();
    await api("/me", { method: "DELETE" });
    forgetDevice();
  });
  ipcMain.handle("p2p:list-members", (_e, groupId: string) => {
    if (!UUID.test(groupId)) throw new Error("group_not_found");
    return api(`/groups/${groupId}/members`);
  });
  ipcMain.handle("p2p:set-display-name", (_e, name: string) =>
    api("/me", { method: "PUT", body: { name } }),
  );
  ipcMain.handle("p2p:ably-token", () => api("/ably-auth"));
  ipcMain.handle("p2p:ice-servers", () => getIceServers());
  ipcMain.handle("p2p:get-turn-config", () => loadTurnConfig());
  ipcMain.handle("p2p:save-turn-config", (_e, config: TurnConfig | null) => saveTurnConfig(config));

  ipcMain.handle("p2p:client-listen", (e, port: number) => tunnel.listen(e.sender, port));
  ipcMain.on("p2p:host-connect", (e, connId: string, port: number) => {
    if (UUID.test(connId)) tunnel.connectToServer(e.sender, connId, port);
  });
  ipcMain.on("p2p:tcp-write", (_e, connId: string, data: Uint8Array) => tunnel.write(connId, data));
  ipcMain.on("p2p:tcp-end", (_e, connId: string) => tunnel.end(connId));
  ipcMain.on("p2p:tcp-pause", (_e, connId: string) => tunnel.pause(connId));
  ipcMain.on("p2p:tcp-resume", (_e, connId: string) => tunnel.resume(connId));
  ipcMain.on("p2p:close-all", () => tunnel.closeAll());
}
