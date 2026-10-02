import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_so/app.dart';
import 'package:posgodinov_so/core/di/injection.dart';

void main() {
  testWidgets('App renders root without crashing', (WidgetTester tester) async {
    setupDependencies();
    await tester.pumpWidget(const PosGodinovSoApp());
    expect(find.byType(PosGodinovSoApp), findsOneWidget);
  });
}
