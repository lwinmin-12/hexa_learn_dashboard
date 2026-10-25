import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteMessage, getChannel, getMembers, getMessages, postMessage, removeMember, updateChannel } from './api';
import { queryKeys } from '@/lib/query-keys';

export function useChannel(courseId: string) {
  return useQuery({ queryKey: queryKeys.channel(courseId), queryFn: () => getChannel(courseId), enabled: Boolean(courseId) });
}

export function useChannelMessages(channelId: string) {
  return useQuery({ queryKey: [...queryKeys.channel(channelId), 'messages'], queryFn: () => getMessages(channelId), enabled: Boolean(channelId) });
}

export function useChannelMembers(channelId: string) {
  return useQuery({ queryKey: [...queryKeys.channel(channelId), 'members'], queryFn: () => getMembers(channelId), enabled: Boolean(channelId) });
}

export function usePostMessage(channelId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (values: { title: string; body: string }) => postMessage(channelId, values.title, values.body), onSuccess: () => client.invalidateQueries({ queryKey: [...queryKeys.channel(channelId), 'messages'] }) });
}

export function useUpdateChannel(courseId: string, channelId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (name: string) => updateChannel(channelId, name), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.channel(courseId) }) });
}

export function useDeleteChannelMessage(channelId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteMessage, onSuccess: () => client.invalidateQueries({ queryKey: [...queryKeys.channel(channelId), 'messages'] }) });
}

export function useRemoveChannelMember(channelId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => removeMember(channelId, userId), onSuccess: () => client.invalidateQueries({ queryKey: [...queryKeys.channel(channelId), 'members'] }) });
}
