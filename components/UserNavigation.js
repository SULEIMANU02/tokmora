import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from "../Screens/HomeScreen";
import WhatsappStatusScreen from "../Screens/WhatsappStatusScreen";
import DownloadsScreen from "../Screens/DownloadsScreen";

const Stack = createNativeStackNavigator();
function UserNavigation() {
  return (
    <Stack.Navigator
      screenOptions={{
      headerShown:false,
      animation: 'none'
      }}
   >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Saver" component={WhatsappStatusScreen} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} />
     
    </Stack.Navigator>
  );
}
export default UserNavigation;