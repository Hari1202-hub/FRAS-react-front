import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AllEmployees from './employees/AllEmployees';
import UnassignedEmployees from './employees/UnassignedEmployees';
import AssignedEmployees from './employees/AssignedEmployees';
import { TanseeqImportModal } from '@/components/employees/TanseeqImportModal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { BASEURL } from '../../app';
import { TOKEN } from '../../app';
import { CloudDownload } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const Employees = () => {
  // State to track the active tab
  const [activeTab, setActiveTab] = useState('all');
  const [isTanseeqModalOpen, setIsTanseeqModalOpen] = useState(false);

  const handleExportEntrolled = () => {
    const downloadUrl = `${BASEURL}export_enrolled_csv`;
    window.location.href = `${downloadUrl}?token=${TOKEN()}`;
  };

  const handleExportNotEntrolled = () => {
    const downloadUrl = `${BASEURL}export_not_enrolled_csv`;
    window.location.href = `${downloadUrl}?token=${TOKEN()}`;
  };

  useEffect(() => {
    loadEmployees();
  }, []);
  const [employees_length, setEmployees_length] = useState(0);
  const loadEmployees = () =>{
      //setLoading(true); // start loading
      const postData = new FormData();
     // postData.append('assigned_role', 0);
      //postData.append('page', );
  
       // Add filters to the request
      postData.append('search', '');
      postData.append('status', '');
      postData.append('entrolled', '');
      postData.append('employee', '');
      postData.append('category', '');
      postData.append('entity', '');
      postData.append('classification', '');
      postData.append('roles', '');
      axios.post(BASEURL+'web_employees',postData, {
        headers: { "Content-Type": "multipart/form-data", "Authorization": `Bearer ${TOKEN()}` }
      }).then(response=>{
        console.log(response.data.data.employees);
          let employees = response.data.data.employees;
          setEmployees_length(employees.length);
          
      }).catch(error=>{
          console.error('Error fetching employees:', error);
      })
    }

  const handleTanseeqImport = (newEmployees) => {
    const maxId = employees_length ? employees_length : 0; 
    const employeesToAdd = newEmployees.map((emp, index) => {
      return {
        id: maxId + +emp.id,
        name: emp.name,
        employeeId: emp.employeeId,        
        category: emp.category,
        entity: emp.entity,
        contactNumber: emp.contactNumber || '',
        email: emp.email,
        status: emp.status,
        classification: emp.classification,
      };
    });
    console.log(employeesToAdd); //Imported employees with new IDs
    axios.post(BASEURL+'import_csv',{data: employeesToAdd}, {
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${TOKEN()}` }
      }).then(response=>{
        toast.success(`${response.data.existing} Already exists, ${response.data.inserted} Employees imported successfully!`);     
        loadEmployees(); 
      }).catch(error=>{
          console.error('Error fetching employees:', error);
          toast.error('Failed to import employees. Please try again.');
      })
  };

  return (
    <div className='space-y-6'>
      <div className='flex flex-col'>
        <div className='flex justify-between items-center mb-3'>
          <h1 className='text-2xl font-bold text-gray-800 mb-4'>
            Employees Management
          </h1>
          <div className='flex justify-between items-center'>
            <Button
              className='flex items-center gap-2 p-3 ml-4'
              onClick={() => setIsTanseeqModalOpen(true)}
            >
              <CloudDownload className='h-4 w-4 mr-2' />
              Import Employees from Excel
            </Button>

            <Button
              className='flex items-center gap-2 p-3 ml-4'
              onClick={handleExportNotEntrolled}
            >
              Export Not Entrolled Employees
            </Button>
            <Button
              className='flex items-center gap-2 p-3 ml-4'
              onClick={handleExportEntrolled}
            >
              Export Entrolled Employees
            </Button>
          </div>
        </div>
        <Card className='p-4'>
          <Tabs
            defaultValue='all'
            value={activeTab}
            onValueChange={setActiveTab}
            className='w-full'
          >
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='all'>All Employees</TabsTrigger>
              <TabsTrigger value='unassigned'>Unassigned Employees</TabsTrigger>
              <TabsTrigger value='assigned'>Assigned Employees</TabsTrigger>
            </TabsList>

            <TabsContent value='all' className='mt-4'>
              <AllEmployees />
            </TabsContent>

            <TabsContent value='unassigned' className='mt-4'>
              <UnassignedEmployees />
            </TabsContent>

            <TabsContent value='assigned' className='mt-4'>
              <AssignedEmployees />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      {isTanseeqModalOpen && (
        <TanseeqImportModal
          open={isTanseeqModalOpen}
          onOpenChange={() => setIsTanseeqModalOpen(false)}
          onImportComplete={handleTanseeqImport}
        />
      )}
    </div>
  );
};

export default Employees;
