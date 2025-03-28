
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, HelpCircle } from 'lucide-react';
import { evaluationCriteria, getEmployeeById, addEvaluation, updateEvaluation, getEvaluationById } from '@/lib/data';
import { Employee, CriteriaScore } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Textarea } from '@/components/ui/textarea';

interface EvaluationFormProps {
  employeeId?: string;
  evaluationId?: string;
}

const EvaluationForm = ({ employeeId, evaluationId }: EvaluationFormProps) => {
  const [employee, setEmployee] = useState<Employee | undefined>(
    employeeId ? getEmployeeById(employeeId) : undefined
  );
  const [step, setStep] = useState(1);
  const [selectedTab, setSelectedTab] = useState('performance');
  const [formData, setFormData] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const { user, isAdmin, isManager, isPemimpin, isKaryawan } = useAuth();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const viewOnly = searchParams.get('view') === 'true' || (!isManager && !isAdmin);

  useEffect(() => {
    // Only managers and admins can perform evaluations
    if (!isManager && !isAdmin && !viewOnly) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya manager dan admin yang dapat melakukan penilaian.",
        variant: "destructive"
      });
      navigate('/');
    }
    
    // If evaluationId is provided, load the evaluation data
    if (evaluationId) {
      const evaluation = getEvaluationById(evaluationId);
      if (evaluation) {
        // Load scores into formData
        const scores: Record<string, number> = {};
        evaluation.criteriaScores.forEach(score => {
          scores[score.criteriaId] = score.score;
        });
        setFormData(scores);
        setComment(evaluation.overallComment || '');
        
        // If employee wasn't provided in props, get it from the evaluation
        if (!employeeId) {
          setEmployee(getEmployeeById(evaluation.employeeId));
        }
      }
    }
  }, [isManager, isAdmin, viewOnly, toast, navigate, evaluationId, employeeId]);

  const handleBack = () => {
    navigate('/employees');
  };

  // Show evaluation results for non-managers/non-admins or in view mode
  if (viewOnly) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Hasil Penilaian</CardTitle>
          <CardDescription>Hasil penilaian kinerja dan kepribadian</CardDescription>
          {employee && (
            <div className="flex items-center gap-3 mt-4">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage src={employee.avatar} alt={employee.name} />
                <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{employee.name}</p>
                <p className="text-xs text-muted-foreground">{employee.position}</p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Skor Kinerja</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Skor</span>
                <span className="text-sm font-medium">{employee?.performance || 0}</span>
              </div>
              <Progress value={employee?.performance || 0} className="h-2" />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Skor Kepribadian</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Skor</span>
                <span className="text-sm font-medium">{employee?.personality || 0}</span>
              </div>
              <Progress value={employee?.personality || 0} className="h-2" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/20 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const performanceCriteria = evaluationCriteria.filter(c => c.category === 'performance');
  const personalityCriteria = evaluationCriteria.filter(c => c.category === 'personality');

  // Calculate progress
  useEffect(() => {
    const filledFields = Object.keys(formData).length;
    const totalFields = evaluationCriteria.length;
    setProgress((filledFields / totalFields) * 100);
  }, [formData]);

  const handleCriteriaChange = (criteriaId: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      [criteriaId]: value
    }));
  };

  const handleStepChange = (newStep: number) => {
    if (newStep === 1) {
      setSelectedTab('performance');
    } else if (newStep === 2) {
      setSelectedTab('personality');
    } else {
      setSelectedTab('comments');
    }
    setStep(newStep);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all criteria are filled
    const isComplete = evaluationCriteria.every(c => formData[c.id] !== undefined);
    
    if (!isComplete) {
      toast({
        title: "Form belum lengkap",
        description: "Harap isi semua kriteria penilaian.",
        variant: "destructive"
      });
      return;
    }
    
    if (!employee) {
      toast({
        title: "Error",
        description: "Data karyawan tidak ditemukan.",
        variant: "destructive"
      });
      return;
    }
    
    // Prepare criteria scores
    const criteriaScores: CriteriaScore[] = Object.keys(formData).map(criteriaId => ({
      criteriaId,
      score: formData[criteriaId]
    }));
    
    // Calculate scores for display
    const performanceScore = performanceCriteria.reduce((total, criteria) => {
      return total + ((formData[criteria.id] || 0) * criteria.weight / 100);
    }, 0);
    
    const personalityScore = personalityCriteria.reduce((total, criteria) => {
      return total + ((formData[criteria.id] || 0) * criteria.weight / 100);
    }, 0);
    
    // If evaluationId exists, update the evaluation
    if (evaluationId) {
      updateEvaluation(evaluationId, {
        criteriaScores,
        overallComment: comment,
        date: new Date().toISOString().split('T')[0]
      });
      
      toast({
        title: "Penilaian Berhasil Diperbarui",
        description: `Skor Kinerja: ${performanceScore.toFixed(1)}, Skor Kepribadian: ${personalityScore.toFixed(1)}`,
        variant: "default"
      });
    } else {
      // Create new evaluation
      addEvaluation({
        employeeId: employee.id,
        managerId: user?.id || '',
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        criteriaScores,
        overallComment: comment
      });
      
      toast({
        title: "Penilaian Berhasil Disimpan",
        description: `Skor Kinerja: ${performanceScore.toFixed(1)}, Skor Kepribadian: ${personalityScore.toFixed(1)}`,
        variant: "default"
      });
    }
    
    // Navigate back to employees list
    navigate('/employees');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-4 mb-6">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Form Penilaian</CardTitle>
                <CardDescription>
                  Nilai karyawan berdasarkan kriteria yang telah ditetapkan
                </CardDescription>
              </div>
              {employee && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{employee.name}</p>
                    <p className="text-xs text-muted-foreground">{employee.position}</p>
                  </div>
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarImage src={employee.avatar} alt={employee.name} />
                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
            <Progress value={progress} className="h-1.5 mt-4" />
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="w-full mb-6">
                <TabsTrigger value="performance" onClick={() => handleStepChange(1)} className="w-full">
                  Kinerja
                </TabsTrigger>
                <TabsTrigger value="personality" onClick={() => handleStepChange(2)} className="w-full">
                  Kepribadian
                </TabsTrigger>
                <TabsTrigger value="comments" onClick={() => handleStepChange(3)} className="w-full">
                  Komentar
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="performance" className="space-y-6">
                {performanceCriteria.map((criteria) => (
                  <div key={criteria.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={criteria.id} className="text-sm font-medium">
                          {criteria.name} <span className="text-muted-foreground">({criteria.weight}%)</span>
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{criteria.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <span className="text-sm font-medium">
                        {formData[criteria.id] || 0}
                      </span>
                    </div>
                    <Slider
                      id={criteria.id}
                      max={100}
                      step={5}
                      value={[formData[criteria.id] || 0]}
                      onValueChange={(values) => handleCriteriaChange(criteria.id, values[0])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Minimum</span>
                      <span>Maximum</span>
                    </div>
                  </div>
                ))}
              </TabsContent>
              
              <TabsContent value="personality" className="space-y-6">
                {personalityCriteria.map((criteria) => (
                  <div key={criteria.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={criteria.id} className="text-sm font-medium">
                          {criteria.name} <span className="text-muted-foreground">({criteria.weight}%)</span>
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{criteria.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <span className="text-sm font-medium">
                        {formData[criteria.id] || 0}
                      </span>
                    </div>
                    <RadioGroup 
                      value={formData[criteria.id]?.toString() || ''} 
                      onValueChange={(value) => handleCriteriaChange(criteria.id, parseInt(value))}
                      className="grid grid-cols-5 gap-2"
                    >
                      {[20, 40, 60, 80, 100].map((value) => (
                        <div key={value} className="flex items-center space-x-2">
                          <RadioGroupItem value={value.toString()} id={`${criteria.id}-${value}`} />
                          <Label htmlFor={`${criteria.id}-${value}`} className="text-xs">
                            {value === 20 && 'Sangat Rendah'}
                            {value === 40 && 'Rendah'}
                            {value === 60 && 'Sedang'}
                            {value === 80 && 'Tinggi'}
                            {value === 100 && 'Sangat Tinggi'}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </TabsContent>
              
              <TabsContent value="comments" className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comments" className="text-sm font-medium">
                      Komentar Keseluruhan
                    </Label>
                    <Textarea
                      id="comments"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Berikan komentar tentang kinerja dan kepribadian karyawan secara keseluruhan..."
                      className="mt-2"
                      rows={6}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="border-t p-6 flex justify-between bg-muted/20">
            {step === 1 ? (
              <div></div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleStepChange(step - 1)}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === 2 ? 'Kinerja' : 'Kepribadian'}
              </Button>
            )}
            
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => handleStepChange(step + 1)}
                className="gap-1"
              >
                {step === 1 ? 'Kepribadian' : 'Komentar'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="gap-1">
                <CheckCircle className="h-4 w-4" />
                Simpan Penilaian
              </Button>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    </form>
  );
};

export default EvaluationForm;
