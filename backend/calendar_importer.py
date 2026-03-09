import httpx
from bs4 import BeautifulSoup
from datetime import datetime
from typing import List, Dict, Any
import re


async def import_austin_yacht_club_calendar(url: str = "https://austinyachtclub.net/series-racing-calendar/") -> List[Dict[str, Any]]:
    """
    Import events from Austin Yacht Club racing calendar.
    Returns a list of event dictionaries.
    """
    events = []
    errors = []
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
            
        soup = BeautifulSoup(response.text, 'lxml')
        
        # Try different parsing strategies based on the page structure
        events = _parse_table_format(soup, url)
        
        if not events:
            events = _parse_list_format(soup, url)
        
        if not events:
            events = _parse_calendar_format(soup, url)
        
        # Post-process: detect series and enumerate events
        events = _process_series_events(events)
            
    except httpx.HTTPError as e:
        errors.append(f"HTTP error fetching calendar: {str(e)}")
    except Exception as e:
        errors.append(f"Error parsing calendar: {str(e)}")
    
    return events, errors


def _process_series_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Process events to detect series and enumerate them.
    If an event name contains 'Series', extract series name and add enumeration.
    """
    # Group events by potential series name
    series_groups = {}
    non_series_events = []
    
    for event in events:
        name = event.get('name', '')
        series_name = _extract_series_name(name)
        
        if series_name:
            if series_name not in series_groups:
                series_groups[series_name] = []
            series_groups[series_name].append(event)
        else:
            non_series_events.append(event)
    
    # Process series groups - sort by date and enumerate
    processed_events = []
    
    for series_name, series_events in series_groups.items():
        # Sort by date
        series_events.sort(key=lambda e: e.get('date') or datetime.max)
        
        for i, event in enumerate(series_events, 1):
            event['series'] = series_name
            event['name'] = f"{series_name} #{i}"
            event['series_index'] = i
            event['series_total'] = len(series_events)
            processed_events.append(event)
    
    # Add non-series events
    processed_events.extend(non_series_events)
    
    # Sort all by date
    processed_events.sort(key=lambda e: e.get('date') or datetime.max)
    
    return processed_events


def _extract_series_name(name: str) -> str:
    """
    Extract series name from event name if it contains 'Series'.
    Returns the series name or None if not a series event.
    """
    if not name:
        return None
    
    # Check if 'series' is in the name (case insensitive)
    if 'series' not in name.lower():
        return None
    
    # Try to extract series name - typically "Something Series" or "Series Something"
    # Remove any existing numbering like #1, Race 1, etc.
    cleaned = re.sub(r'\s*#\d+\s*', ' ', name)
    cleaned = re.sub(r'\s*Race\s*\d+\s*', ' ', cleaned, flags=re.I)
    cleaned = re.sub(r'\s*Event\s*\d+\s*', ' ', cleaned, flags=re.I)
    cleaned = re.sub(r'\s*\d+\s*$', '', cleaned)  # Trailing numbers
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    return cleaned if cleaned else None


def _parse_table_format(soup: BeautifulSoup, source_url: str) -> List[Dict[str, Any]]:
    """Parse events from table format."""
    events = []
    
    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        headers = []
        
        header_row = table.find('tr')
        if header_row:
            headers = [th.get_text(strip=True).lower() for th in header_row.find_all(['th', 'td'])]
        
        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 2:
                continue
            
            event_data = _extract_event_from_row(cells, headers)
            if event_data:
                event_data['imported_from'] = source_url
                events.append(event_data)
    
    return events


def _parse_list_format(soup: BeautifulSoup, source_url: str) -> List[Dict[str, Any]]:
    """Parse events from list/div format."""
    events = []
    
    # Look for common event container patterns
    event_containers = soup.find_all(['div', 'article'], class_=re.compile(r'event|race|regatta', re.I))
    
    for container in event_containers:
        event_data = _extract_event_from_container(container)
        if event_data:
            event_data['imported_from'] = source_url
            events.append(event_data)
    
    return events


def _parse_calendar_format(soup: BeautifulSoup, source_url: str) -> List[Dict[str, Any]]:
    """Parse events from calendar grid format."""
    events = []
    
    # Look for calendar day cells with events
    calendar_events = soup.find_all(['a', 'span', 'div'], class_=re.compile(r'fc-event|calendar-event|event-title', re.I))
    
    for event_elem in calendar_events:
        title = event_elem.get_text(strip=True)
        if title and len(title) > 2:
            # Try to find associated date
            parent = event_elem.parent
            date_str = None
            
            for _ in range(5):  # Look up to 5 levels
                if parent is None:
                    break
                date_attr = parent.get('data-date') or parent.get('datetime')
                if date_attr:
                    date_str = date_attr
                    break
                parent = parent.parent
            
            if date_str:
                try:
                    event_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    events.append({
                        'name': title,
                        'date': event_date,
                        'event_type': 'race',
                        'imported_from': source_url
                    })
                except ValueError:
                    pass
    
    return events


def _extract_event_from_row(cells: list, headers: list) -> Dict[str, Any]:
    """Extract event data from a table row."""
    event = {}
    
    # Map cell values to fields
    date_keywords = ['date', 'when', 'day']
    name_keywords = ['event', 'name', 'race', 'title', 'regatta']
    type_keywords = ['type', 'category', 'class']
    series_keywords = ['series']
    
    for i, cell in enumerate(cells):
        text = cell.get_text(strip=True)
        if not text:
            continue
        
        header = headers[i] if i < len(headers) else ""
        
        # Try to identify the field
        if any(kw in header for kw in date_keywords) or _looks_like_date(text):
            parsed_date = _parse_date(text)
            if parsed_date:
                event['date'] = parsed_date
        elif any(kw in header for kw in name_keywords) or (not event.get('name') and len(text) > 3):
            event['name'] = text
            link = cell.find('a')
            if link and link.get('href'):
                event['external_url'] = link.get('href')
        elif any(kw in header for kw in type_keywords):
            event['event_type'] = text
        elif any(kw in header for kw in series_keywords):
            event['series'] = text
    
    # Validate we have minimum required fields
    if event.get('name') and event.get('date'):
        if not event.get('event_type'):
            event['event_type'] = 'race'
        return event
    
    return None


def _extract_event_from_container(container) -> Dict[str, Any]:
    """Extract event data from a container element."""
    event = {}
    
    # Look for title
    title_elem = container.find(['h1', 'h2', 'h3', 'h4', '.title', '.event-title'])
    if title_elem:
        event['name'] = title_elem.get_text(strip=True)
    
    # Look for date
    date_elem = container.find(['time', '.date', '.event-date'])
    if date_elem:
        date_str = date_elem.get('datetime') or date_elem.get_text(strip=True)
        event['date'] = _parse_date(date_str)
    
    # Look for link
    link = container.find('a')
    if link and link.get('href'):
        event['external_url'] = link.get('href')
    
    if event.get('name') and event.get('date'):
        event['event_type'] = 'race'
        return event
    
    return None


def _looks_like_date(text: str) -> bool:
    """Check if text looks like a date."""
    date_patterns = [
        r'\d{1,2}/\d{1,2}/\d{2,4}',
        r'\d{1,2}-\d{1,2}-\d{2,4}',
        r'\d{4}-\d{2}-\d{2}',
        r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)',
        r'(january|february|march|april|may|june|july|august|september|october|november|december)',
    ]
    text_lower = text.lower()
    return any(re.search(pattern, text_lower) for pattern in date_patterns)


def _parse_date(text: str) -> datetime:
    """Try to parse a date from text using multiple formats."""
    if not text:
        return None
    
    formats = [
        '%Y-%m-%d',
        '%Y-%m-%dT%H:%M:%S',
        '%m/%d/%Y',
        '%m/%d/%y',
        '%d/%m/%Y',
        '%B %d, %Y',
        '%b %d, %Y',
        '%B %d %Y',
        '%b %d %Y',
        '%d %B %Y',
        '%d %b %Y',
    ]
    
    text = text.strip()
    
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    
    # Try with regex extraction
    match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', text)
    if match:
        month, day, year = match.groups()
        year = int(year)
        if year < 100:
            year += 2000
        try:
            return datetime(year, int(month), int(day))
        except ValueError:
            pass
    
    return None


async def fetch_calendar_preview(url: str) -> Dict[str, Any]:
    """
    Fetch and preview calendar data without importing.
    Returns structure information about the calendar page.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'lxml')
        
        return {
            'title': soup.title.string if soup.title else 'Unknown',
            'tables_found': len(soup.find_all('table')),
            'potential_events': len(soup.find_all(['div', 'article'], class_=re.compile(r'event|race', re.I))),
            'calendar_elements': len(soup.find_all(['a', 'div'], class_=re.compile(r'fc-event|calendar', re.I))),
            'status': 'success'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }
