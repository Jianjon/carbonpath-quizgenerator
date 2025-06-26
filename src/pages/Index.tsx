
import React from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { FeatureCards } from '@/components/FeatureCards';
import { QuestionBankGenerator } from '@/components/QuestionBankGenerator';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <HeroSection />
        <FeatureCards />
        <QuestionBankGenerator />
      </main>
    </div>
  );
};

export default Index;
