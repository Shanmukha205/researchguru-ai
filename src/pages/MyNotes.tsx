import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Save, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function MyNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadNotes();
  }, [user]);

  useEffect(() => {
    if (selectedNote && (title !== selectedNote.title || content !== selectedNote.content)) {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      const timeout = setTimeout(() => {
        autoSave();
      }, 2000);
      setAutoSaveTimeout(timeout);
    }
    return () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    };
  }, [title, content]);

  const loadNotes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("research_notes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Failed to load notes");
      return;
    }
    setNotes(data || []);
  };

  const createNewNote = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("research_notes")
      .insert({ user_id: user.id, title: "Untitled Note", content: "" })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create note");
      return;
    }
    setNotes([data, ...notes]);
    setSelectedNote(data);
    setTitle(data.title);
    setContent(data.content);
    toast.success("Note created");
  };

  const autoSave = async () => {
    if (!selectedNote || !user) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("research_notes")
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", selectedNote.id);

    if (error) {
      toast.error("Auto-save failed");
    } else {
      setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, title, content, updated_at: new Date().toISOString() } : n));
    }
    setIsSaving(false);
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("research_notes").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete note");
      return;
    }
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
      setTitle("");
      setContent("");
    }
    toast.success("Note deleted");
  };

  const exportAsText = () => {
    if (!selectedNote) return;
    const blob = new Blob([`${title}\n\n${content}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
  };

  const exportAsPDF = () => {
    if (!selectedNote) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 20, 20);
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(content, 170);
    doc.text(lines, 20, 35);
    doc.save(`${title.replace(/[^a-z0-9]/gi, "_")}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          My Research Notes
        </h1>
        <p className="text-muted-foreground text-lg">
          Your personal research notepad with auto-save
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notes List */}
        <Card className="glass-effect border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                All Notes
              </CardTitle>
              <CardDescription>{notes.length} notes</CardDescription>
            </div>
            <Button onClick={createNewNote} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                  selectedNote?.id === note.id
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border/50 hover:bg-accent/50"
                }`}
                onClick={() => {
                  setSelectedNote(note);
                  setTitle(note.title);
                  setContent(note.content);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{note.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {notes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No notes yet. Create your first note!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Note Editor */}
        <Card className="lg:col-span-2 glass-effect border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedNote ? "Edit Note" : "Select or Create a Note"}
              </CardTitle>
              {isSaving && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Saving...
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedNote ? (
              <>
                <Input
                  placeholder="Note title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-semibold"
                />
                <Textarea
                  placeholder="Start writing your research notes here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={autoSave} className="gap-2">
                    <Save className="h-4 w-4" />
                    Save Now
                  </Button>
                  <Button onClick={exportAsText} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export .txt
                  </Button>
                  <Button onClick={exportAsPDF} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-saves every 2 seconds after you stop typing
                </p>
              </>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a note from the list or create a new one to start editing</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
