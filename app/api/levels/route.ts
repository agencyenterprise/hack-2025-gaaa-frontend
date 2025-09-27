import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error('API_URL environment variable is not configured');
      return NextResponse.json(
        { error: 'API_URL environment variable is not configured' },
        { status: 500 }
      );
    }

    const gameName = request.nextUrl.searchParams.get('gameName');
    if (!gameName) {
      console.error('gameName is not configured');
      return NextResponse.json(
        { error: 'gameName is not configured' },
        { status: 500 }
      );
    }


    // Make the request to the external API from the server
    const response = await fetch(`${apiUrl}/api/v1/games/${gameName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        // Add any other headers needed for the external API
      },
      // Add timeout and other fetch options if needed
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response body:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch levels: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Successfully fetched data from external API');

    // Extract user_objective and structure the response
    const levels = data.levels || [];

    console.log('Levels:', levels);

    // Structure the response to include user_objective and levels data
    const structuredData = {
      levels: levels.map((level: any, index: number) => ({
        id: level.id || level._id || `level-${index}`,
        name: level.name || level.title || `Level ${index + 1}`,
        difficulty: level.difficulty || level.level || undefined,
        userObjective: level.user_objective || level.description || undefined,
      })),
      raw_data: data // Keep raw data for backward compatibility
    };

    console.log('Structured data:', structuredData);

    // Return the structured data with CORS headers
    return NextResponse.json(structuredData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error in levels API proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error('API_URL environment variable is not configured');
      return NextResponse.json(
        { error: 'API_URL environment variable is not configured' },
        { status: 500 }
      );
    }

    // Get the level ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const levelId = pathParts[pathParts.length - 1] || 'default';

    console.log(`Proxying POST request to: ${apiUrl}/api/v1/games/password/${levelId}`);

    // Parse the request body
    const body = await request.json();

    // Make the request to the external API from the server
    const response = await fetch(`${apiUrl}/api/v1/games/password/${levelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        // Add any other headers needed for the external API
      },
      body: JSON.stringify(body),
      // Add timeout and other fetch options if needed
      signal: AbortSignal.timeout(30000), // 30 second timeout for AI requests
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response body:', errorText);
      return NextResponse.json(
        { error: `Failed to process request: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Successfully proxied POST request to external API');

    // Return the data with CORS headers
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error in levels API proxy POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
