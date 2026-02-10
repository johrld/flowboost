"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StageBadge, ConditionBadge } from "@/components/status-badge";
import { articles, authors, categories, mockArticleContent } from "@/lib/mock-data";
import { ArrowLeft, Save, Eye, Check, ImageIcon, Plus, Trash2, Upload, Undo2, Play, AlertTriangle } from "lucide-react";
import Link from "next/link";

// Simple markdown preview (no Tiptap yet - will be added in 6.6)
function MarkdownPreview({ content }: { content: string }) {
  // Strip frontmatter
  const body = content.replace(/^---[\s\S]*?---\n*/, "");
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {body.split("\n").map((line, i) => {
        if (line.startsWith("## ")) {
          return <h2 key={i} className="text-lg font-bold mt-6 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith("### ")) {
          return <h3 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith("> ")) {
          return (
            <blockquote key={i} className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4">
              {line.slice(2)}
            </blockquote>
          );
        }
        if (line.startsWith("- ")) {
          return <li key={i} className="ml-4">{line.slice(2)}</li>;
        }
        if (line.match(/^\d+\./)) {
          return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
        }
        if (line.trim() === "") return <br key={i} />;
        // Bold
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}
    </div>
  );
}

export default function ArticleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const article = articles.find((a) => a.id === id);
  const [activeLang, setActiveLang] = useState("de");
  const [isPreview, setIsPreview] = useState(false);

  // Parse frontmatter from mock content
  const frontmatterMatch = mockArticleContent.match(/^---\n([\s\S]*?)\n---/);
  const frontmatterText = frontmatterMatch ? frontmatterMatch[1] : "";

  // Simple frontmatter parse
  const titleMatch = frontmatterText.match(/title:\s*"(.+?)"/);
  const descMatch = frontmatterText.match(/description:\s*"(.+?)"/);
  const faqMatches = [...frontmatterText.matchAll(/- question:\s*"(.+?)"\n\s*answer:\s*"(.+?)"/g)];

  const [title, setTitle] = useState(titleMatch?.[1] ?? article?.title ?? "");
  const [description, setDescription] = useState(descMatch?.[1] ?? "");
  const [faqs, setFaqs] = useState(
    faqMatches.map((m) => ({ question: m[1], answer: m[2] }))
  );

  if (!article) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Article not found</p>
        <Link href="/create" className="text-primary underline text-sm">
          Back to Articles
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/create">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{article.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StageBadge stage={article.stage} />
              <ConditionBadge condition={article.condition} />
              <span className="text-xs text-muted-foreground">
                Last edited: {article.lastEditedAt ?? "never"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsPreview(!isPreview)}>
              <Eye className="mr-2 h-4 w-4" />
              {isPreview ? "Edit" : "Preview"}
            </Button>
            <Button variant="outline">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>

            {/* Status-aware actions */}
            {article.condition === "needs_review" && (
              <Button>
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
            {article.stage === "ready" && article.condition === "ok" && (
              <Button className="bg-green-600 hover:bg-green-700">
                <Upload className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
            {article.condition === "editing" && (
              <>
                <Button variant="outline" className="text-muted-foreground">
                  <Undo2 className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Upload className="mr-2 h-4 w-4" />
                  Re-Publish
                </Button>
              </>
            )}
            {article.stage === "draft" && (
              <Button>
                <Play className="mr-2 h-4 w-4" />
                Produce
              </Button>
            )}
          </div>
        </div>

        {/* Editing Banner */}
        {article.condition === "editing" && (
          <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-950">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                This article is live and has unpublished changes
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Published {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("de-DE") : "—"} — Re-publish to update the live version or discard to revert.
              </p>
            </div>
          </div>
        )}

        {/* Producing Banner */}
        {article.stage === "producing" && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
            <Play className="h-4 w-4 text-blue-600 shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Pipeline is producing this article
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Content is being generated. Check the Pipeline page for progress.
              </p>
            </div>
          </div>
        )}

        {/* Language Tabs */}
        <Tabs value={activeLang} onValueChange={setActiveLang}>
          <TabsList>
            <TabsTrigger value="de">DE</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
            <TabsTrigger value="es">ES</TabsTrigger>
          </TabsList>

          <TabsContent value="de" className="mt-4">
            {isPreview ? (
              <Card>
                <CardContent className="p-6">
                  <MarkdownPreview content={mockArticleContent} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <Textarea
                    className="min-h-[600px] font-mono text-sm"
                    defaultValue={mockArticleContent.replace(/^---[\s\S]*?---\n*/, "")}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="en" className="mt-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  English translation not yet available
                </p>
                <Button variant="outline" size="sm" className="mt-3">
                  Generate Translation
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="es" className="mt-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Spanish translation not yet available
                </p>
                <Button variant="outline" size="sm" className="mt-3">
                  Generate Translation
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* FAQ Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">FAQ ({faqs.length})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {faqs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No FAQ items yet. Add questions for rich snippets.
              </p>
            )}
            {faqs.map((faq, i) => (
              <div key={i} className="flex gap-3 items-start rounded-md border p-3">
                <Badge variant="outline" className="text-xs shrink-0 mt-1">
                  Q{i + 1}
                </Badge>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Question"
                    value={faq.question}
                    onChange={(e) => {
                      const updated = [...faqs];
                      updated[i] = { ...updated[i], question: e.target.value };
                      setFaqs(updated);
                    }}
                    className="text-sm"
                  />
                  <Textarea
                    placeholder="Answer"
                    value={faq.answer}
                    onChange={(e) => {
                      const updated = [...faqs];
                      updated[i] = { ...updated[i], answer: e.target.value };
                      setFaqs(updated);
                    }}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar - Metadata */}
      <div className="w-80 shrink-0 overflow-y-auto border-l bg-muted/30 p-6 space-y-6">
        {/* Frontmatter */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Metadata</h3>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/70 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/160 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select defaultValue={article.category}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.labels.de}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Author</Label>
            <Select defaultValue={article.author}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {authors.map((author) => (
                  <SelectItem key={author.id} value={author.id}>
                    {author.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Hero Image */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Hero Image</h3>
          <div className="flex items-center justify-center rounded-md border border-dashed bg-muted/50 p-8">
            <div className="text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">No image</p>
              <Button variant="outline" size="sm" className="mt-2">
                Generate
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
