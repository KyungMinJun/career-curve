import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BottomTabBar, TabId } from '@/components/layout/BottomTabBar';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import { BoardTab } from '@/components/tabs/BoardTab';
import { CareerTab } from '@/components/tabs/CareerTab';
import { GoalsTab } from '@/components/tabs/GoalsTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';

type NavigateToTabDetail = TabId | { tab: TabId; tailoredResumeId?: string };

const VALID_TABS: TabId[] = ['board', 'career', 'goals', 'settings'];

const Index = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // Determine initial tab from URL or default to 'board'
  const initialTab = (tab && VALID_TABS.includes(tab as TabId)) ? (tab as TabId) : 'board';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Handle tab change and update URL
  const handleTabChange = useCallback((newTab: TabId) => {
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      navigate(`/${newTab}`);
    }
  }, [activeTab, navigate]);

  // Sync URL with activeTab state
  useEffect(() => {
    if (!tab) {
      // Root path, redirect to board
      navigate('/board', { replace: true });
      return;
    }

    const urlTab = tab;
    // Handle legacy /chat URL - redirect to /board
    if (urlTab === 'chat') {
      navigate('/board', { replace: true });
      return;
    }

    if (VALID_TABS.includes(urlTab as TabId) && urlTab !== activeTab) {
      setActiveTab(urlTab as TabId);
    } else if (!VALID_TABS.includes(urlTab as TabId)) {
      // Invalid tab in URL, redirect to board
      navigate('/board', { replace: true });
    }
  }, [tab, activeTab, navigate]);

  // Handle custom navigation events (from dialogs, etc.)
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<NavigateToTabDetail>;
      const detail = custom.detail;
      if (!detail) return;

      const targetTab = typeof detail === 'string' ? detail : detail.tab;
      handleTabChange(targetTab);
    };

    window.addEventListener('navigate-to-tab', handler as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handler as EventListener);
  }, [handleTabChange]);

  const renderTab = () => {
    switch (activeTab) {
      case 'board':
        return <BoardTab />;
      case 'career':
        return <CareerTab />;
      case 'goals':
        return <GoalsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <BoardTab />;
    }
  };

  return (
    <>
      <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="lg:ml-64">
        <AppLayout>
          <div className="h-screen flex flex-col">
            {renderTab()}
          </div>
        </AppLayout>
      </div>
      <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
    </>
  );
};

export default Index;
