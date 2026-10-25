import { api } from '@/lib/api';
import type { Page } from '@/lib/domain';

export type Channel = { id: string; courseId: string; name: string };
export type ChannelMessage = { id: string; title: string; body: string; createdAt: string };
export type ChannelMember = { id: string; user: { id: string; displayName: string | null; email?: string | null }; joinedAt: string };
export async function getChannel(courseId: string) {
  const { data } = await api.get<Channel>(`/admin/courses/${courseId}/channel`);
  return data;
}
export async function getMessages(channelId: string, page = 1, limit = 20) {
  const { data } = await api.get<Page<ChannelMessage>>(`/admin/channels/${channelId}/messages`, { params: { page, limit } });
  return data;
}
export async function postMessage(channelId: string, title: string, body: string) {
  const { data } = await api.post<ChannelMessage>(`/admin/channels/${channelId}/messages`, { title, body });
  return data;
}
export async function updateChannel(channelId: string, name: string) {
  const { data } = await api.patch<Channel>(`/admin/channels/${channelId}`, { name });
  return data;
}
export async function deleteMessage(id: string) {
  const { data } = await api.delete(`/admin/messages/${id}`);
  return data;
}
export async function removeMember(channelId: string, userId: string) {
  const { data } = await api.delete(`/admin/channels/${channelId}/members/${userId}`);
  return data;
}
export async function getMembers(channelId: string, page = 1, limit = 20) {
  const { data } = await api.get<Page<ChannelMember>>(`/admin/channels/${channelId}/members`, { params: { page, limit } });
  return data;
}
