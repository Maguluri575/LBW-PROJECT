import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, RotateCcw, Ruler, CircleDot, Target, Camera, Settings2, Layers } from 'lucide-react';
import { getSettings, saveSettings, type AnalysisSettings } from '@/services/settingsService';

const DEFAULTS: AnalysisSettings = {
  pitch_length: 22,
  pitch_width: 10,
  crease_distance: 4,
  pitch_surface: 'concrete',
  ball_type: 'tennis',
  stump_height: 28,
  stump_width: 9,
  confidence_threshold: 50,
  camera_angle: 'side',
  camera_distance: 'medium',
};

export default function Settings() {
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    toast.info('Settings reset to defaults');
  };

  const update = <K extends keyof AnalysisSettings>(key: K, value: AnalysisSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Settings2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">Configure pitch and analysis parameters</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Pitch Dimensions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-primary" />
              Pitch Dimensions
            </CardTitle>
            <CardDescription>Set the playing surface measurements for accurate trajectory calculation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pitch_length">Pitch Length (yards)</Label>
                <Input
                  id="pitch_length"
                  type="number"
                  min={10}
                  max={30}
                  step={0.5}
                  value={settings.pitch_length}
                  onChange={(e) => update('pitch_length', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Standard: 22 yards</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pitch_width">Pitch Width (feet)</Label>
                <Input
                  id="pitch_width"
                  type="number"
                  min={5}
                  max={15}
                  step={0.5}
                  value={settings.pitch_width}
                  onChange={(e) => update('pitch_width', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Standard: 10 feet</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="crease_distance">Crease Distance (feet)</Label>
                <Input
                  id="crease_distance"
                  type="number"
                  min={2}
                  max={6}
                  step={0.5}
                  value={settings.crease_distance}
                  onChange={(e) => update('crease_distance', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Standard: 4 feet</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pitch Surface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Pitch Surface
            </CardTitle>
            <CardDescription>Surface type affects bounce height and ball behavior predictions</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={settings.pitch_surface} onValueChange={(v) => update('pitch_surface', v)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concrete">Concrete</SelectItem>
                <SelectItem value="turf">Turf</SelectItem>
                <SelectItem value="matting">Matting</SelectItem>
                <SelectItem value="mud">Mud</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Ball Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDot className="h-5 w-5 text-primary" />
              Ball Type
            </CardTitle>
            <CardDescription>Ball type affects speed, bounce height, and swing predictions</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={settings.ball_type} onValueChange={(v) => update('ball_type', v)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tennis">Tennis Ball</SelectItem>
                <SelectItem value="tape">Tape Ball</SelectItem>
                <SelectItem value="leather">Leather Ball</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Stump Dimensions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Stump Dimensions
            </CardTitle>
            <CardDescription>Customize stump height and width for your setup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stump_height">Stump Height (inches)</Label>
                <Input
                  id="stump_height"
                  type="number"
                  min={20}
                  max={32}
                  step={0.5}
                  value={settings.stump_height}
                  onChange={(e) => update('stump_height', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Standard: 28 inches</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stump_width">Total Stump Width (inches)</Label>
                <Input
                  id="stump_width"
                  type="number"
                  min={6}
                  max={12}
                  step={0.5}
                  value={settings.stump_width}
                  onChange={(e) => update('stump_width', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Standard: 9 inches</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Camera Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Camera Setup
            </CardTitle>
            <CardDescription>Describe your camera position for trajectory calibration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Camera Angle</Label>
                <Select value={settings.camera_angle} onValueChange={(v) => update('camera_angle', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="side">Side View</SelectItem>
                    <SelectItem value="semi-side">Semi-Side View</SelectItem>
                    <SelectItem value="behind">Behind Stumps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Camera Distance</Label>
                <Select value={settings.camera_distance} onValueChange={(v) => update('camera_distance', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="close">Close (5-10m)</SelectItem>
                    <SelectItem value="medium">Medium (10-20m)</SelectItem>
                    <SelectItem value="far">Far (20m+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confidence Threshold */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Analysis Settings
            </CardTitle>
            <CardDescription>Fine-tune the decision engine parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Confidence Threshold</Label>
                <span className="text-sm font-medium text-primary">{settings.confidence_threshold}%</span>
              </div>
              <Slider
                value={[settings.confidence_threshold]}
                onValueChange={([v]) => update('confidence_threshold', v)}
                min={25}
                max={95}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Minimum confidence required to declare an OUT decision. Lower values are more aggressive.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
