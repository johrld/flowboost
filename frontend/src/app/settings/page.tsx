"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projects, authors, categories } from "@/lib/mock-data";
import { Save, Plus, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const project = projects[0];
  const [projectName, setProjectName] = useState(project.name);
  const [connector, setConnector] = useState(project.connector);
  const [articlesPerWeek, setArticlesPerWeek] = useState(
    project.publishFrequency?.articlesPerWeek ?? 3
  );

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Project configuration</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="brand">Brand Voice</TabsTrigger>
          <TabsTrigger value="connector">Connector</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project</CardTitle>
              <CardDescription>Basic project settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Languages</Label>
                <div className="flex gap-2">
                  {project.languages.map((lang) => (
                    <Badge key={lang} variant="secondary">
                      {lang.toUpperCase()}
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Publishing Frequency</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={articlesPerWeek}
                    onChange={(e) => setArticlesPerWeek(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">articles per week</span>
                </div>
              </div>

              <Button>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authors */}
        <TabsContent value="authors" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Authors</h3>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-3 w-3" />
              Add Author
            </Button>
          </div>
          {authors.map((author) => (
            <Card key={author.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{author.name}</p>
                  <p className="text-sm text-muted-foreground">{author.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{author.id}</Badge>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Categories</h3>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-3 w-3" />
              Add Category
            </Button>
          </div>
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{cat.labels.de}</p>
                  <div className="flex gap-2 mt-1">
                    {Object.entries(cat.labels).map(([lang, label]) => (
                      <span key={lang} className="text-xs text-muted-foreground">
                        {lang.toUpperCase()}: {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{cat.id}</Badge>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Brand Voice */}
        <TabsContent value="brand" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Voice Guidelines</CardTitle>
              <CardDescription>
                Define your brand tone, forbidden terms, and writing style
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="min-h-[400px] font-mono text-sm"
                defaultValue={`# Brand Voice

## Tone
- Warm, supportive, knowledgeable
- Du-Ansprache (German informal)
- Evidence-based, no esoteric claims

## Forbidden Terms
- Guru, Master, Enlightenment
- "Guaranteed results"
- Medical claims without citations

## Writing Style
- Short paragraphs (2-4 sentences)
- Active voice preferred
- Practical, actionable advice
- Include scientific references where possible`}
              />
              <Button>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connector */}
        <TabsContent value="connector" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing Connector</CardTitle>
              <CardDescription>
                Configure how articles are published to your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Connector Type</Label>
                <Select value={connector} onValueChange={(v) => setConnector(v as typeof connector)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="git">Git (Push to Repository)</SelectItem>
                    <SelectItem value="wordpress">WordPress (REST API)</SelectItem>
                    <SelectItem value="filesystem">Filesystem (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {connector === "git" && (
                <>
                  <div className="space-y-2">
                    <Label>Repository URL</Label>
                    <Input defaultValue="github.com/user/breathe-website" />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Input defaultValue="main" />
                  </div>
                  <div className="space-y-2">
                    <Label>Content Path</Label>
                    <Input defaultValue="src/content/posts/" />
                  </div>
                </>
              )}

              {connector === "wordpress" && (
                <>
                  <div className="space-y-2">
                    <Label>WordPress URL</Label>
                    <Input placeholder="https://your-site.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input type="password" placeholder="Application password" />
                  </div>
                </>
              )}

              <Button>
                <Save className="mr-2 h-4 w-4" />
                Save Connector
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
