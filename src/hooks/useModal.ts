"use client";

import { useState, useCallback } from "react";

export interface ModalState {
  isOpen: boolean;
  data?: any;
}

export function useModal(initialState: boolean = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const [data, setData] = useState<any>(null);

  const open = useCallback((initialData?: any) => {
    if (initialData) {
      setData(initialData);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Clear data after animation completes
    setTimeout(() => setData(null), 300);
  }, []);

  const toggle = useCallback((initialData?: any) => {
    if (isOpen) {
      close();
    } else {
      open(initialData);
    }
  }, [isOpen, open, close]);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setData,
  };
}

export interface ModalGroupState {
  [key: string]: ModalState;
}

export function useModalGroup(modals: string[]) {
  const [modalStates, setModalStates] = useState<ModalGroupState>(
    modals.reduce((acc, modal) => {
      acc[modal] = { isOpen: false, data: null };
      return acc;
    }, {} as ModalGroupState)
  );

  const openModal = useCallback(
    (modalName: string, data?: any) => {
      setModalStates((prev) => ({
        ...prev,
        [modalName]: { isOpen: true, data },
      }));
    },
    []
  );

  const closeModal = useCallback((modalName: string) => {
    setModalStates((prev) => ({
      ...prev,
      [modalName]: { isOpen: false, data: null },
    }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModalStates((prev) =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key] = { isOpen: false, data: null };
        return acc;
      }, {} as ModalGroupState)
    );
  }, []);

  const getModalState = useCallback(
    (modalName: string) => modalStates[modalName],
    [modalStates]
  );

  const getModalIsOpen = useCallback(
    (modalName: string) => modalStates[modalName]?.isOpen ?? false,
    [modalStates]
  );

  const getModalData = useCallback(
    (modalName: string) => modalStates[modalName]?.data,
    [modalStates]
  );

  return {
    modalStates,
    openModal,
    closeModal,
    closeAllModals,
    getModalState,
    getModalIsOpen,
    getModalData,
  };
}
