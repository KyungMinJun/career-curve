import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BottomTabBar, TabId } from '@/components/layout/BottomTabBar';
import { ChatTab } from '@/components/tabs/ChatTab';
import { BoardTab } from '@/components/tabs/BoardTab';
import { CareerTab } from '@/components/tabs/CareerTab';
import { GoalsTab } from '@/components/tabs/GoalsTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';

type NavigateToTabDetail = TabId | { tab: TabId; tailoredResumeId?: string };

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>('chat');

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<NavigateToTabDetail>;
      const detail = custom.detail;
      if (!detail) return;

      const tab = typeof detail === 'string' ? detail : detail.tab;
      setActiveTab(tab);
    };

    window.addEventListener('navigate-to-tab', handler as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handler as EventListener);
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatTab onNavigateToBoard={() => setActiveTab('board')} />;
      case 'board':
        return <BoardTab />;
      case 'career':
        return <CareerTab />;
      case 'goals':
        return <GoalsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <ChatTab onNavigateToBoard={() => setActiveTab('board')} />;
    }
  };

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        {renderTab()}
      </div>
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </AppLayout>
  );
};

export default Index;
