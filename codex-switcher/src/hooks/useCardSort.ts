import { useState, useCallback, useRef, useEffect } from 'react';
import type { AccountWithUsage } from '../types';
import { api } from '../api';

export function useCardSort(accounts: AccountWithUsage[]) {
  const [order, setOrder] = useState<string[]>(() => accounts.map((a) => a.id));
  const dragIdRef = useRef<string | null>(null);

  // Keep order in sync when accounts are added or removed
  useEffect(() => {
    setOrder((prev) => {
      const existing = new Set(accounts.map((a) => a.id));
      const kept = prev.filter((id) => existing.has(id));
      const added = accounts.filter((a) => !prev.includes(a.id)).map((a) => a.id);
      const next = [...kept, ...added];
      // If nothing changed, return the same reference to avoid re-renders
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, [accounts]);

  const sortedAccounts = order
    .map((id) => accounts.find((a) => a.id === id))
    .filter((a): a is AccountWithUsage => a != null);

  const onDragStart = useCallback((id: string, e: React.DragEvent) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragIdRef.current || dragIdRef.current === id) return;
    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragIdRef.current!);
      const to = next.indexOf(id);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragIdRef.current!);
      return next;
    });
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const finalOrder = order;
      dragIdRef.current = null;
      await api.updateSortOrder(finalOrder.map((id, i) => ({ id, sort_order: i })));
    },
    [order],
  );

  const onDragEnd = useCallback(() => {
    dragIdRef.current = null;
  }, []);

  return { sortedAccounts, onDragStart, onDragOver, onDrop, onDragEnd };
}
