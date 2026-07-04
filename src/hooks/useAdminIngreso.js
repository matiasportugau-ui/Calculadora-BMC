import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCockpitOperatorAuth } from "./useCockpitOperatorAuth.js";
import { adminIngresoFetch } from "../utils/adminIngresoApi.js";
import { ensureAdminIngresoSuccess } from "../utils/adminIngresoState.js";

function hasReachedReady(interp) {
  return Boolean(interp?.ready_to_quote && interp?.quotable !== false);
}

export function useAdminIngreso() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cockpit = useCockpitOperatorAuth({ role: "admin" });
  const { token, user } = cockpit;

  const [inquiries, setInquiries] = useState([]);
  const [sheetsStatus, setSheetsStatus] = useState("checking");
  const [selectedRow, setSelectedRow] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [interpretation, setInterpretation] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const initialRowHandled = useRef(false);
  const toastTimeoutRef = useRef(null);

  const rowFromUrl = useMemo(() => {
    const n = Number(searchParams.get("row"));
    return Number.isInteger(n) && n >= 2 ? n : null;
  }, [searchParams]);

  const showToast = useCallback((message, type = "info") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      toastTimeoutRef.current = null;
      setToast(null);
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  const loadInquiries = useCallback(async () => {
    if (!token) {
      setSheetsStatus("down");
      return;
    }
    setSheetsStatus("checking");
    const { ok, data } = await adminIngresoFetch(token, "/api/inquiries");
    if (!ok) {
      setSheetsStatus("down");
      setInquiries([]);
      setError(data?.error || "No se pudo cargar la planilla");
      return;
    }
    setSheetsStatus("up");
    setError("");
    setInquiries(Array.isArray(data) ? data : []);
  }, [token]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  const syncRowParam = useCallback(
    (row) => {
      const next = new URLSearchParams(searchParams);
      if (row) next.set("row", String(row));
      else next.delete("row");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const interpretRow = useCallback(
    async (row, consulta, convo, newUserMessage) => {
      const { ok, data } = await adminIngresoFetch(token, `/api/interpret/${row}`, {
        method: "POST",
        body: JSON.stringify({
          consulta,
          conversation: convo,
          newUserMessage: newUserMessage || "",
        }),
      });
      if (!ok || data?.error) throw new Error(data?.error || "Error al interpretar");
      return data;
    },
    [token],
  );

  const saveConversation = useCallback(
    async (row, convo) => {
      const result = await adminIngresoFetch(token, `/api/conversation/${row}`, {
        method: "POST",
        body: JSON.stringify(convo),
      });
      ensureAdminIngresoSuccess(result, "Error al guardar conversación");
    },
    [token],
  );

  const selectRow = useCallback(
    async (row, inquiryList = inquiries) => {
      if (!token || busy) return;
      setSelectedRow(row);
      syncRowParam(row);
      setConversation(null);
      setInterpretation(null);
      setBusy("load");
      setError("");

      const { ok, data } = await adminIngresoFetch(token, `/api/conversation/${row}`);
      if (!ok) {
        setBusy(null);
        setError(data?.error || "Error al cargar conversación");
        return;
      }

      const consulta =
        data?.consulta ||
        inquiryList.find((i) => i.row === row)?.consulta ||
        "";

      if (data?.consulta && Array.isArray(data.turns) && data.turns.length > 0) {
        const convo = { consulta: data.consulta, turns: data.turns };
        setConversation(convo);
        const lastAi = [...data.turns].reverse().find((t) => t.role === "ai");
        setInterpretation(lastAi?.interpretation || null);
        setBusy(null);
        return;
      }

      if (!consulta) {
        setBusy(null);
        setError("No se encontró la consulta para esta fila");
        return;
      }

      try {
        const interp = await interpretRow(row, consulta, null, "");
        const convo = {
          consulta,
          turns: [{ role: "ai", interpretation: interp }],
        };
        setConversation(convo);
        setInterpretation(interp);
        await saveConversation(row, convo);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(null);
      }
    },
    [token, busy, inquiries, interpretRow, saveConversation, syncRowParam],
  );

  useEffect(() => {
    if (!token || !inquiries.length || initialRowHandled.current) return;
    initialRowHandled.current = true;
    const target = rowFromUrl && inquiries.some((i) => i.row === rowFromUrl)
      ? rowFromUrl
      : inquiries[0]?.row;
    if (target) selectRow(target, inquiries);
  }, [token, inquiries, rowFromUrl, selectRow]);

  const sendMessage = useCallback(
    async (text) => {
      const msg = String(text || "").trim();
      if (!msg || !selectedRow || !conversation || busy) return;
      if (hasReachedReady(interpretation)) return;

      const row = selectedRow;
      const nextTurns = [...conversation.turns, { role: "user", text: msg }];
      const convoDraft = { consulta: conversation.consulta, turns: nextTurns };
      setConversation(convoDraft);
      setBusy("interpret");

      try {
        const interp = await interpretRow(row, conversation.consulta, convoDraft, msg);
        const convoFinal = {
          consulta: conversation.consulta,
          turns: [...nextTurns, { role: "ai", interpretation: interp }],
        };
        setConversation(convoFinal);
        setInterpretation(interp);
        await saveConversation(row, convoFinal);
      } catch (e) {
        setError(e.message);
        showToast(e.message, "error");
      } finally {
        setBusy(null);
      }
    },
    [selectedRow, conversation, interpretation, busy, interpretRow, saveConversation, showToast],
  );

  const writeToSheet = useCallback(async () => {
    if (!selectedRow || !interpretation || busy) return;
    setBusy("write");
    const { ok, data } = await adminIngresoFetch(token, `/api/write/${selectedRow}`, {
      method: "POST",
      body: JSON.stringify({ interpretation }),
    });
    setBusy(null);
    if (!ok || data?.success === false) {
      showToast(data?.error || "Error al escribir en la planilla", "error");
      return;
    }
    showToast("Datos escritos en columnas J, K y L", "success");
    await loadInquiries();
  }, [selectedRow, interpretation, busy, token, loadInquiries, showToast]);

  const selectNext = useCallback(() => {
    if (!selectedRow || !inquiries.length) return;
    const idx = inquiries.findIndex((i) => i.row === selectedRow);
    const next = inquiries[idx + 1] || inquiries[0];
    if (next) selectRow(next.row);
  }, [selectedRow, inquiries, selectRow]);

  const ready = hasReachedReady(interpretation);

  return {
    ...cockpit,
    userEmail: user?.email || "",
    inquiries,
    sheetsStatus,
    selectedRow,
    conversation,
    interpretation,
    busy,
    error,
    toast,
    ready,
    loadInquiries,
    selectRow,
    sendMessage,
    writeToSheet,
    selectNext,
    showToast,
  };
}