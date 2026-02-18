"""
Analysis Storage Module
=======================
Handles persistence of LBW analysis results.
"""

import os
import json
from typing import Dict, List, Optional
from datetime import datetime


class AnalysisStorage:
    """File-based storage for analysis results."""
    
    def __init__(self, results_dir: str):
        self.results_dir = results_dir
        os.makedirs(results_dir, exist_ok=True)
        self._index_file = os.path.join(results_dir, 'index.json')
        self._load_index()
    
    def _load_index(self):
        """Load the index of all analyses."""
        if os.path.exists(self._index_file):
            with open(self._index_file, 'r') as f:
                self._index = json.load(f)
        else:
            self._index = {'analyses': {}, 'hash_map': {}}
    
    def _save_index(self):
        """Save the index."""
        with open(self._index_file, 'w') as f:
            json.dump(self._index, f, indent=2)
    
    def save_result(self, analysis_id: str, result: Dict) -> bool:
        """Save an analysis result."""
        result_path = os.path.join(self.results_dir, f'{analysis_id}.json')
        
        with open(result_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        # Update index
        self._index['analyses'][analysis_id] = {
            'id': analysis_id,
            'timestamp': result.get('timestamp', datetime.now().isoformat()),
            'decision': result.get('decision'),
            'videoName': result.get('videoName')
        }
        
        # Update hash map for deduplication
        file_hash = result.get('fileHash')
        if file_hash:
            self._index['hash_map'][file_hash] = analysis_id
        
        self._save_index()
        return True
    
    def get_result(self, analysis_id: str) -> Optional[Dict]:
        """Get a specific analysis result."""
        result_path = os.path.join(self.results_dir, f'{analysis_id}.json')
        
        if not os.path.exists(result_path):
            return None
        
        with open(result_path, 'r') as f:
            return json.load(f)
    
    def delete_result(self, analysis_id: str) -> bool:
        """Delete an analysis result."""
        result_path = os.path.join(self.results_dir, f'{analysis_id}.json')
        
        if not os.path.exists(result_path):
            return False
        
        # Remove from hash map
        result = self.get_result(analysis_id)
        if result and result.get('fileHash'):
            self._index['hash_map'].pop(result['fileHash'], None)
        
        # Remove file and index entry
        os.remove(result_path)
        self._index['analyses'].pop(analysis_id, None)
        self._save_index()
        
        return True
    
    def get_all_results(self) -> List[Dict]:
        """Get all analysis results."""
        results = []
        
        for analysis_id in self._index.get('analyses', {}):
            result = self.get_result(analysis_id)
            if result:
                results.append(result)
        
        return results
    
    def find_by_hash(self, file_hash: str) -> Optional[Dict]:
        """Find an existing analysis by file hash."""
        analysis_id = self._index.get('hash_map', {}).get(file_hash)
        
        if analysis_id:
            return self.get_result(analysis_id)
        
        return None
