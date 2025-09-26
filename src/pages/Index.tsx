import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filter, Users, Database, FileText, BarChart3, Shield, Upload, CheckCircle, Settings } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Scaler</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Enterprise Ready
            </Badge>
            <Link to="/auth">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="hero" size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-1 gap-12 items-center justify-center text-center">
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="space-y-4">
                <Badge variant="outline" className="w-fit mx-auto">
                  🚀 AI-Powered Filtering
                </Badge>
                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  Smart Candidate
                  <br />
                  <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Filtering System
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Filter candidate profiles with precision using built-in rules and dynamic filtering. 
                  Streamline your recruitment process with enterprise-grade tools. Access via secure email link.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/upload">
                  <Button variant="hero" size="xl">
                    <Upload className="h-5 w-5" />
                    Upload Raw Data
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" size="xl">
                    <Settings className="h-5 w-5" />
                    Sign In with Email
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  Multi-stage filtering
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  Enterprise security
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  Real-time results
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="mb-4">
              Core Features
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              Powerful Filtering Engine
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Advanced filtering capabilities with built-in admin controls and user-customizable rules
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="card-shadow transition-smooth hover:enterprise-shadow">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Raw Data Processing</CardTitle>
                <CardDescription>
                  Upload structured CSV files with candidate profiles including experience, titles, and company history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Fixed file structure validation</li>
                  <li>• Automatic data normalization</li>
                  <li>• Secure Supabase storage</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow">
              <CardHeader>
                <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                  <Filter className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle>Multi-Stage Filtering</CardTitle>
                <CardDescription>
                  Two-stage filtering process with company-based rules and user-defined criteria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Stage 1: Company & Lists</li>
                  <li>• Stage 2: User Rules</li>
                  <li>• Synonym matching</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow">
              <CardHeader>
                <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Admin Control Panel</CardTitle>
                <CardDescription>
                  Manage built-in lists including target companies, universities, and synonyms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• NotRelevant Companies</li>
                  <li>• Target Companies</li>
                  <li>• Top Universities</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Netly Integration</CardTitle>
                <CardDescription>
                  Cross-check filtered results with additional files to identify overlapping profiles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Profile comparison</li>
                  <li>• Overlap detection</li>
                  <li>• Separate CSV export</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow">
              <CardHeader>
                <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle>Real-time Analytics</CardTitle>
                <CardDescription>
                  View filtering results with detailed analytics and export capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Stage-by-stage results</li>
                  <li>• Filter effectiveness metrics</li>
                  <li>• CSV export functionality</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow">
              <CardHeader>
                <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Built with enterprise-grade security featuring role-based access control
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Role-based permissions</li>
                  <li>• Secure data handling</li>
                  <li>• User isolation</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Netly Integration Section */}
      <section className="py-20 bg-secondary/5">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="mb-4">
              Netly Integration
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              Advanced Profile Cross-Checking
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload additional Netly files to identify overlapping profiles and enhance your filtering results
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Profile Comparison</h3>
                </div>
                <p className="text-muted-foreground">
                  Cross-reference your filtered candidates with existing Netly files to identify potential overlaps and duplicates.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-secondary/10 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold">Smart Detection</h3>
                </div>
                <p className="text-muted-foreground">
                  Our intelligent matching algorithm identifies overlapping profiles based on names and additional candidate data.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-accent/10 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold">Separate Exports</h3>
                </div>
                <p className="text-muted-foreground">
                  Get dedicated CSV exports for overlapping profiles, allowing you to manage and track candidate relationships effectively.
                </p>
              </div>
            </div>

            <div className="bg-card p-8 rounded-lg border card-shadow">
              <h4 className="text-xl font-semibold mb-4">Netly Integration Benefits</h4>
              <ul className="space-y-3">
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0" />
                  <span>Prevent duplicate outreach</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0" />
                  <span>Maintain relationship history</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0" />
                  <span>Enhanced candidate tracking</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0" />
                  <span>Streamlined workflow management</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Transform Your
              <br />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Sourcing Process?
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Join leading companies using Scaler to streamline candidate filtering 
              and improve hiring efficiency.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/upload">
                <Button variant="hero" size="xl">
                  <Upload className="h-5 w-5" />
                  Start Filtering Now
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="xl">
                  <FileText className="h-5 w-5" />
                  Sign In with Email
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">Scaler</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 Scaler by AddedValue
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;