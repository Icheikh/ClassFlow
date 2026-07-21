"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Badge, ConfirmModal } from "@/components/ui"
import { Plus, Layers, Trash2 } from "lucide-react"
import toast from "react-hot-toast"

type Stage = { id: string; name: string; order: number; levels: Level[] }
type Level = { id: string; name: string; order: number; stageId: string; streams: Stream[] }
type Stream = { id: string; name: string; code: string | null }

export default function LevelsPage() {
  const t = useTranslations("levelsPage")
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [showStageModal, setShowStageModal] = useState(false)
  const [showLevelModal, setShowLevelModal] = useState(false)
  const [showStreamModal, setShowStreamModal] = useState(false)
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null)

  const [stageName, setStageName] = useState("")
  const [stageOrder, setStageOrder] = useState("")
  const [levelName, setLevelName] = useState("")
  const [levelOrder, setLevelOrder] = useState("")
  const [streamName, setStreamName] = useState("")
  const [streamCode, setStreamCode] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "level" | "stream"; id: string } | null>(null)

  const fetchData = async () => {
    const { data } = await api.get<Stage[]>("/api/school/stages")
    if (data) setStages(data)
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  async function saveStage() {
    if (!stageName) { toast.error(t("stageNameRequired")); return }
    const { error } = await api.post("/api/school/stages", { name: stageName, order: stageOrder || "1" })
    if (error) toast.error(error)
    else { toast.success(t("stageAdded")); setShowStageModal(false); setStageName(""); setStageOrder(""); fetchData() }
  }

  async function saveLevel() {
    if (!levelName || !selectedStage) return
    const { error } = await api.post("/api/school/levels", { stageId: selectedStage.id, name: levelName, order: levelOrder || "1" })
    if (error) toast.error(error)
    else { toast.success(t("levelAdded")); setShowLevelModal(false); setLevelName(""); setLevelOrder(""); fetchData() }
  }

  async function saveStream() {
    if (!streamName || !selectedLevel) return
    const { error } = await api.post("/api/school/streams", { levelId: selectedLevel.id, name: streamName, code: streamCode })
    if (error) toast.error(error)
    else { toast.success(t("streamAdded")); setShowStreamModal(false); setStreamName(""); setStreamCode(""); fetchData() }
  }

  async function deleteLevel(id: string) {
    const { error } = await api.delete(`/api/school/levels?id=${id}`)
    setDeleteConfirm(null)
    if (error) toast.error(error); else { toast.success(t("deleted")); fetchData() }
  }

  async function deleteStream(id: string) {
    const { error } = await api.delete(`/api/school/streams?id=${id}`)
    setDeleteConfirm(null)
    if (error) toast.error(error); else { toast.success(t("deleted")); fetchData() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={() => { setStageName(""); setStageOrder(""); setShowStageModal(true) }}>
          <Plus className="h-5 w-5" /> {t("addStage")}
        </Button>
      </div>

      <Modal open={showStageModal} onClose={() => setShowStageModal(false)} title={t("addStage")}>
        <div className="space-y-4">
          <Input label={t("stageName")} value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder={t("stageNamePlaceholder")} />
          <Input label={t("order")} type="number" value={stageOrder} onChange={(e) => setStageOrder(e.target.value)} />
          <Button fullWidth onClick={saveStage}>{t("save")}</Button>
        </div>
      </Modal>

      <Modal open={showLevelModal} onClose={() => setShowLevelModal(false)} title={t("addLevelInStage", { stage: selectedStage?.name || "" })}>
        <div className="space-y-4">
          <Input label={t("levelName")} value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder={t("levelNamePlaceholder")} />
          <Input label={t("order")} type="number" value={levelOrder} onChange={(e) => setLevelOrder(e.target.value)} />
          <Button fullWidth onClick={saveLevel}>{t("save")}</Button>
        </div>
      </Modal>

      <Modal open={showStreamModal} onClose={() => setShowStreamModal(false)} title={t("addStreamInLevel", { level: selectedLevel?.name || "" })}>
        <div className="space-y-4">
          <Input label={t("streamName")} value={streamName} onChange={(e) => setStreamName(e.target.value)} placeholder={t("streamNamePlaceholder")} />
          <Input label={t("streamCode")} value={streamCode} onChange={(e) => setStreamCode(e.target.value)} placeholder={t("streamCodePlaceholder")} />
          <Button fullWidth onClick={saveStream}>{t("save")}</Button>
        </div>
      </Modal>

      {loading ? (
        <Card><p className="text-center text-gray-400 py-8">{t("loading")}</p></Card>
      ) : stages.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Layers className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{t("noStages")}</p>
            <Button className="mt-4" onClick={() => setShowStageModal(true)}><Plus className="h-5 w-5" /> {t("addStage")}</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {stages.map((stage) => (
            <Card key={stage.id} padding="lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Layers className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-semibold">{stage.name}</h3>
                  <Badge variant="info">{t("levelsCount", { count: stage.levels.length })}</Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setSelectedStage(stage); setShowLevelModal(true) }}>
                  <Plus className="h-4 w-4" /> {t("addLevel")}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stage.levels.map((level) => (
                  <div key={level.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{level.name}</span>
                      <button onClick={() => setDeleteConfirm({ type: "level", id: level.id })} className="text-red-400 hover:text-red-600" aria-label={t("deleteLevelAria")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {level.streams.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {level.streams.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded text-xs">
                            {s.name}
                            <button onClick={() => setDeleteConfirm({ type: "stream", id: s.id })} className="text-red-300 hover:text-red-500" aria-label={t("deleteStreamAria")}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {stage.order >= 3 && (
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedLevel(level); setShowStreamModal(true) }}>
                        <Plus className="h-3 w-3" /> {t("addStream")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.type === "level") void deleteLevel(deleteConfirm.id)
          else if (deleteConfirm?.type === "stream") void deleteStream(deleteConfirm.id)
        }}
        title={deleteConfirm?.type === "level" ? t("deleteLevel") : t("deleteStream")}
        message={t("confirmDelete")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        variant="danger"
      />
    </div>
  )
}
