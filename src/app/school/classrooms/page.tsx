"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Select, Badge, ConfirmModal } from "@/components/ui"
import { Plus, DoorOpen, Edit2, Trash2, Eye } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type Classroom = {
  id: string
  name: string
  capacity: number
  level: { id: string; name: string; stage: { name: string } }
  stream: { id: string; name: string } | null
}
type Level = { id: string; name: string; stage: { name: string } }
type Stream = { id: string; name: string; levelId: string }

export default function ClassroomsPage() {
  const t = useTranslations("classroomsPage")
  const tCommon = useTranslations("common")
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Classroom | null>(null)

  const [name, setName] = useState("")
  const [levelId, setLevelId] = useState("")
  const [streamId, setStreamId] = useState("")
  const [capacity, setCapacity] = useState("40")
  const [classroomToDelete, setClassroomToDelete] = useState<string | null>(null)

  async function fetchData() {
    const [classroomsRes, levelsRes, streamsRes] = await Promise.all([
      api.get<Classroom[]>("/api/school/classrooms"),
      api.get<Level[]>("/api/school/levels"),
      api.get<Stream[]>("/api/school/streams"),
    ])
    if (classroomsRes.data) setClassrooms(classroomsRes.data)
    if (levelsRes.data) setLevels(levelsRes.data)
    if (streamsRes.data) setStreams(streamsRes.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const selectedLevel = levels.find((level) => level.id === levelId) || null
  const filteredStreams = streams.filter((stream) => stream.levelId === levelId)
  const isSecondaryLevel = selectedLevel?.stage.name.includes("ثانوي") ?? false

  function openAdd() {
    setEditing(null)
    setName("")
    setLevelId("")
    setStreamId("")
    setCapacity("40")
    setShowModal(true)
  }

  function openEdit(classroom: Classroom) {
    setEditing(classroom)
    setName(classroom.name)
    setLevelId(classroom.level.id)
    setStreamId(classroom.stream?.id || "")
    setCapacity(String(classroom.capacity))
    setShowModal(true)
  }

  async function save() {
    if (!name || !levelId) {
      toast.error(t("fillFields"))
      return
    }

    if (isSecondaryLevel && !streamId) {
      toast.error(t("secondaryStreamRequired"))
      return
    }

    const payload = {
      name,
      levelId,
      streamId: streamId || null,
      capacity,
    }

    const { error } = editing
      ? await api.put("/api/school/classrooms", { id: editing.id, ...payload })
      : await api.post("/api/school/classrooms", payload)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(editing ? t("updateSuccess") : t("createSuccess"))
    setShowModal(false)
    fetchData()
  }

  async function deleteItem(id: string) {
    const { error } = await api.delete(`/api/school/classrooms?id=${id}`)
    setClassroomToDelete(null)
    if (error) toast.error(error)
    else {
      toast.success(t("deleteSuccess"))
      fetchData()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-5 w-5" /> {t("addClassroom")}
        </Button>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? t("editClassroom") : t("addClassroom")}>
        <div className="space-y-4">
          <Select
            label={t("level")}
            value={levelId}
            onChange={(value) => {
              setLevelId(value)
              setStreamId("")
            }}
            options={levels.map((level) => ({ value: level.id, label: `${level.stage.name} - ${level.name}` }))}
            placeholder={t("levelPlaceholder")}
          />

          {filteredStreams.length > 0 && (
            <Select
              label={t("stream")}
              value={streamId}
              onChange={setStreamId}
              options={[{ value: "", label: t("withoutStream") }, ...filteredStreams.map((stream) => ({ value: stream.id, label: stream.name }))]}
              placeholder={t("streamPlaceholder")}
            />
          )}

          <Input label={t("name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
          <Input label={t("capacity")} type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <Button fullWidth onClick={save}>{tCommon("save")}</Button>
        </div>
      </Modal>

      {loading ? (
        <Card>
          <p className="text-center text-gray-400 py-8">{t("loading")}</p>
        </Card>
      ) : classrooms.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <DoorOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{t("empty")}</p>
            <Button className="mt-4" onClick={openAdd}>
              <Plus className="h-5 w-5" /> {t("addClassroom")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map((classroom) => (
            <Card key={classroom.id} className="relative group">
              <Link href={`/school/classrooms/${classroom.id}`} className="block">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-blue-700 group-hover:underline">{classroom.name}</h3>
                    <p className="text-sm text-gray-500">{classroom.level.stage.name} - {classroom.level.name}</p>
                    {classroom.stream && <Badge variant="info">{classroom.stream.name}</Badge>}
                    <p className="text-xs text-gray-400 mt-1">{t("capacityLabel", { count: classroom.capacity })}</p>
                  </div>
                  <Eye className="h-5 w-5 text-gray-300 group-hover:text-blue-500" />
                </div>
              </Link>
              <div className="absolute left-3 bottom-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.preventDefault(); openEdit(classroom) }} className="p-1.5 hover:bg-gray-100 rounded" aria-label={t("editAria")}>
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={(e) => { e.preventDefault(); setClassroomToDelete(classroom.id) }} className="p-1.5 hover:bg-red-50 rounded text-red-400" aria-label={t("deleteAria")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!classroomToDelete}
        onClose={() => setClassroomToDelete(null)}
        onConfirm={() => void deleteItem(classroomToDelete!)}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        variant="danger"
      />
    </div>
  )
}
