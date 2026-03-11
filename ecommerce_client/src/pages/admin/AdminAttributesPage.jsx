import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api.service';
import { toast } from 'react-hot-toast';

const AdminAttributesPage = () => {
  const [attributes, setAttributes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAttributes();
  }, []);

  const fetchAttributes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminAPI.getAttributes();
      
      // Handle different response formats and add mock data if needed
      let attributesData = [];
      if (data && Array.isArray(data)) {
        attributesData = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        attributesData = data.data;
      } else if (data && data.attributes && Array.isArray(data.attributes)) {
        attributesData = data.attributes;
      } else {
        // If no data or API not ready, use mock data
        attributesData = mockAttributes;
      }
      
      // Ensure each attribute has required properties
      const formattedAttributes = attributesData.map(attr => ({
        id: attr.id || Math.random().toString(36).substr(2, 9),
        name: attr.name || 'Unknown Attribute',
        type: attr.type || 'Text',
        status: attr.status || 'active',
        productCount: attr.productCount || attr.product_count || 0,
        valueCount: attr.valueCount || attr.value_count || 0,
        values: attr.values || attr.options || []
      }));
      
      setAttributes(formattedAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      const errorMessage = error.message || 'Failed to load attributes';
      setError(errorMessage);
      toast.error(errorMessage);
      // Fallback to mock data on error
      setAttributes(mockAttributes);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchAttributes();
  };

  const handleEdit = (id) => {
    toast.success(`Edit attribute ${id} - Feature coming soon`);
  };

  const handleViewValues = (id) => {
    toast.success(`View values for attribute ${id} - Feature coming soon`);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this attribute?')) {
      try {
        setError(null);
        await adminAPI.deleteAttribute(id);
        toast.success('Attribute deleted successfully');
        fetchAttributes();
      } catch (error) {
        const errorMessage = error.message || 'Failed to delete attribute';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    }
  };

  const handleAddAttribute = () => {
    toast.success('Add attribute - Feature coming soon');
  };

  const filteredAttributes = attributes.filter(attr =>
    attr.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '30px', background: '#F7F8F8', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2.2em', marginBottom: '10px', color: '#0F1111' }}>Product Attributes</h1>
      <p style={{ color: '#565959', marginBottom: '30px' }}>Manage product attributes and their values</p>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        background: '#FFFFFF',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #D5D9D9'
      }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '500px' }}>
          <input
            type="text"
            placeholder="Search attributes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 15px',
              border: '1px solid #D5D9D9',
              borderRadius: '4px',
              fontSize: '1em'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              background: '#FF9900',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            Search
          </button>
        </div>
        <button
          onClick={handleAddAttribute}
          style={{
            background: '#FF9900',
            color: '#FFFFFF',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
        >
          + Add Attribute
        </button>
      </div>

      {error && (
        <div style={{background: '#FEE', border: '1px solid #C7511F', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: '#C7511F'}}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em'}}>×</button>
        </div>
      )}

      {/* Attributes Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 50px' }}>
          <div style={{fontSize: '3em', marginBottom: '20px'}}>⏳</div>
          <div style={{ color: '#565959', fontSize: '1.2em' }}>Loading attributes...</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {filteredAttributes.map((attribute) => (
            <div
              key={attribute.id}
              style={{
                background: '#FFFFFF',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #D5D9D9',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                <div>
                  <div style={{ fontSize: '1.3em', fontWeight: 600, color: '#0F1111', marginBottom: '5px' }}>
                    {attribute.name}
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    background: '#F7F8F8',
                    borderRadius: '4px',
                    fontSize: '0.85em',
                    color: '#565959'
                  }}>
                    {attribute.type}
                  </span>
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8em',
                  fontWeight: 'bold',
                  background: '#E6F4F1',
                  color: '#067D62'
                }}>
                  {attribute.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', fontSize: '0.9em', color: '#565959' }}>
                <span>📦 Used in {attribute.productCount.toLocaleString()} products</span>
                <span>🔢 {attribute.valueCount ? `${attribute.valueCount} values` : 'Numeric input'}</span>
              </div>

              {/* Values */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
                {attribute.values.map((value, index) => (
                  <span
                    key={index}
                    style={{
                      padding: '5px 12px',
                      background: '#E7F3FF',
                      color: '#146EB4',
                      borderRadius: '4px',
                      fontSize: '0.85em'
                    }}
                  >
                    {value}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '8px',
                paddingTop: '15px',
                borderTop: '1px solid #D5D9D9'
              }}>
                <button
                  onClick={() => handleEdit(attribute.id)}
                  style={{
                    padding: '6px 14px',
                    border: '1px solid #D5D9D9',
                    background: '#FFFFFF',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F7F8F8'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleViewValues(attribute.id)}
                  style={{
                    padding: '6px 14px',
                    border: '1px solid #D5D9D9',
                    background: '#FFFFFF',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F7F8F8'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                >
                  👁️ View {attribute.type === 'Dropdown' ? 'Values' : 'Details'}
                </button>
                <button
                  onClick={() => handleDelete(attribute.id)}
                  style={{
                    padding: '6px 14px',
                    border: '1px solid #D5D9D9',
                    background: '#FFFFFF',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F7F8F8'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredAttributes.length === 0 && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '50px',
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #D5D9D9'
        }}>
          <p style={{ color: '#565959', fontSize: '1.1em' }}>No attributes found</p>
        </div>
      )}
    </div>
  );
};

// Mock data for when API is not available
const mockAttributes = [
  {
    id: 1,
    name: 'Color',
    type: 'Dropdown',
    status: 'active',
    productCount: 1247,
    valueCount: 12,
    values: ['Red', 'Blue', 'Green', 'Black', 'White']
  },
  {
    id: 2,
    name: 'Size',
    type: 'Dropdown',
    status: 'active',
    productCount: 892,
    valueCount: 8,
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  {
    id: 3,
    name: 'Material',
    type: 'Dropdown',
    status: 'active',
    productCount: 634,
    valueCount: 6,
    values: ['Cotton', 'Polyester', 'Wool', 'Silk', 'Leather']
  },
  {
    id: 4,
    name: 'Weight',
    type: 'Number',
    status: 'active',
    productCount: 423,
    valueCount: 0,
    values: []
  },
  {
    id: 5,
    name: 'Brand',
    type: 'Text',
    status: 'active',
    productCount: 1156,
    valueCount: 0,
    values: []
  },
  {
    id: 6,
    name: 'Model',
    type: 'Text',
    status: 'active',
    productCount: 789,
    valueCount: 0,
    values: []
  }
];

export default AdminAttributesPage;
