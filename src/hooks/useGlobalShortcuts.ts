import { useEffect, useCallback } from "react";
import { useCrown } from "../context/CrownContext";
import { soundManager } from "../utils/soundEffects";

export function useGlobalShortcuts() {
  const {
    clearMessages,
    state,
    setActiveView,
    startListening,
    stopListening,
    stopSpeech,
    toggleSpeechSynthesis,
    toggleSound,
    triggerManualDiagnostic,
    isWelcomeOpen,
    closeWelcomeModal,
    isShortcutsOpen,
    openShortcutsModal,
    closeShortcutsModal,
    triggerShortcutFeedback,
  } = useCrown();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInputElement =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // 1. ESCAPE: Close modals or stop active voice
      if (e.key === "Escape") {
        if (isShortcutsOpen) {
          e.preventDefault();
          closeShortcutsModal();
          return;
        }
        if (isWelcomeOpen) {
          e.preventDefault();
          closeWelcomeModal();
          return;
        }
        if (state.isSpeaking) {
          e.preventDefault();
          stopSpeech();
          triggerShortcutFeedback("🔇 Voz detenida (Esc)");
          return;
        }
        if (state.isListening) {
          e.preventDefault();
          stopListening();
          triggerShortcutFeedback("🎤 Micrófono desactivado (Esc)");
          return;
        }
      }

      // 2. Question mark '?' when NOT in an input field -> open shortcuts
      if (e.key === "?" && !isInputElement && !isCmdOrCtrl) {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      // 3. Ctrl/Cmd + / -> Open / toggle shortcuts modal
      if (isCmdOrCtrl && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        if (isShortcutsOpen) {
          closeShortcutsModal();
        } else {
          openShortcutsModal();
        }
        return;
      }

      // 4. Ctrl/Cmd + K -> Clear terminal
      if (isCmdOrCtrl && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        soundManager.playBeep(440, 0.05);
        clearMessages();
        triggerShortcutFeedback("🧹 Terminal Limpiada (Ctrl+K)");
        return;
      }

      // 5. Ctrl/Cmd + L -> Focus command prompt & switch to terminal
      if (isCmdOrCtrl && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        if (state.activeView !== "terminal") {
          setActiveView("terminal");
        }
        soundManager.playBeep(700, 0.03);
        window.dispatchEvent(new CustomEvent("isabella-focus-prompt"));
        triggerShortcutFeedback("⌨️ Campo de Prompt Enfocado (Ctrl+L)");
        return;
      }

      // 6. Ctrl/Cmd + M -> Toggle Voice Mic Input
      if (isCmdOrCtrl && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        if (state.isListening) {
          stopListening();
          triggerShortcutFeedback("🎤 Micrófono Pausado (Ctrl+M)");
        } else {
          startListening();
          triggerShortcutFeedback("🎤 Micrófono Activo (Ctrl+M)");
        }
        return;
      }

      // 7. Ctrl + Shift + S -> Stop speech
      if (isCmdOrCtrl && e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        stopSpeech();
        triggerShortcutFeedback("🔇 Síntesis de Voz Detenida (Ctrl+Shift+S)");
        return;
      }

      // 8. Ctrl + Shift + V -> Toggle speech synthesis ON / OFF
      if (isCmdOrCtrl && e.shiftKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        toggleSpeechSynthesis();
        const nextState = !state.speechSynthesisEnabled;
        triggerShortcutFeedback(
          nextState ? "🔊 Narración por Voz: ACTIVADA (Ctrl+Shift+V)" : "🔇 Narración por Voz: SILENCIADA (Ctrl+Shift+V)"
        );
        return;
      }

      // 9. Ctrl + Shift + F -> Toggle sound effects ON / OFF
      if (isCmdOrCtrl && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        toggleSound();
        const nextState = !state.soundEnabled;
        triggerShortcutFeedback(
          nextState ? "🎵 Efectos de Sonido: ACTIVADOS" : "🔇 Efectos de Sonido: SILENCIADOS"
        );
        return;
      }

      // 10. Ctrl + Shift + D -> Diagnostics /status
      if (isCmdOrCtrl && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        triggerManualDiagnostic();
        triggerShortcutFeedback("⚡ Diagnóstico de Subsistemas Iniciado (Ctrl+Shift+D)");
        return;
      }

      // 11. Alt + 1..6 or (Ctrl+Alt+1..6) -> Quick view switching
      if (e.altKey && !e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveView("terminal");
          soundManager.playBeep(600, 0.03);
          triggerShortcutFeedback("🖥️ Vista: Terminal (Alt+1)");
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("isabella-focus-prompt"));
          }, 50);
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveView("presence");
          soundManager.playBeep(640, 0.03);
          triggerShortcutFeedback("🌸 Vista: Presencia Isabella (Alt+2)");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveView("image_studio");
          soundManager.playBeep(680, 0.03);
          triggerShortcutFeedback("🎨 Vista: Estudio Visual (Alt+3)");
        } else if (e.key === "4") {
          e.preventDefault();
          setActiveView("voice_studio");
          soundManager.playBeep(720, 0.03);
          triggerShortcutFeedback("🎙️ Vista: Estudio de Voz (Alt+4)");
        } else if (e.key === "5") {
          e.preventDefault();
          setActiveView("synapse");
          soundManager.playBeep(760, 0.03);
          triggerShortcutFeedback("⚡ Vista: Flujo Sináptico (Alt+5)");
        } else if (e.key === "6") {
          e.preventDefault();
          setActiveView("telemetry");
          soundManager.playBeep(800, 0.03);
          triggerShortcutFeedback("📊 Vista: Telemetría Cognitiva (Alt+6)");
        } else if (e.key === "7") {
          e.preventDefault();
          setActiveView("presentation");
          soundManager.playBeep(840, 0.03);
          triggerShortcutFeedback("📑 Vista: Presentación & Auditoría (Alt+7)");
        } else if (e.key === "8") {
          e.preventDefault();
          setActiveView("hub");
          soundManager.playBeep(880, 0.03);
          triggerShortcutFeedback("🏢 Vista: Nodo Cero Hub & Gobernanza (Alt+8)");
        }
      }
    },
    [
      clearMessages,
      state,
      setActiveView,
      startListening,
      stopListening,
      stopSpeech,
      toggleSpeechSynthesis,
      toggleSound,
      triggerManualDiagnostic,
      isWelcomeOpen,
      closeWelcomeModal,
      isShortcutsOpen,
      openShortcutsModal,
      closeShortcutsModal,
      triggerShortcutFeedback,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
