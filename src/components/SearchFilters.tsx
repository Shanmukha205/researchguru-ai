import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, Save, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SearchFiltersProps {
  onSearch: (filters: SearchFilter) => void;
}

export interface SearchFilter {
  searchQuery: string;
  agentType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export default function SearchFilters({ onSearch }: SearchFiltersProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SearchFilter>({
    searchQuery: '',
    agentType: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [queryName, setQueryName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleSaveQuery = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('saved_queries')
        .insert([{
          user_id: user.id,
          query_name: queryName,
          filters: filters as any,
        }]);

      if (error) throw error;

      toast({
        title: 'Query saved',
        description: `"${queryName}" has been saved to your filters.`,
      });
      setShowSaveDialog(false);
      setQueryName('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save query',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4 p-6 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Search & Filter</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search outcomes..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Agent Type</Label>
          <Select value={filters.agentType} onValueChange={(value) => setFilters({ ...filters, agentType: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="sentiment">Sentiment</SelectItem>
              <SelectItem value="competitor">Competitor</SelectItem>
              <SelectItem value="trends">Trends</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>From Date</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>To Date</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSearch} className="gap-2">
          <Search className="h-4 w-4" />
          Apply Filters
        </Button>
        
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              Save Query
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Search Query</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Query Name</Label>
                <Input
                  placeholder="e.g., Recent Sentiment Analysis"
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveQuery} className="w-full">
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
